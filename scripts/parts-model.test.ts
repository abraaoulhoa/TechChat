import assert from "node:assert/strict";
import test from "node:test";
import type { Part, PartForm } from "../app/parts/parts-model";

// A URL lets Node's built-in TypeScript runner load the source without changing
// the application's bundler import settings or adding a test dependency.
const model: typeof import("../app/parts/parts-model") = await import(new URL("../app/parts/parts-model.ts", import.meta.url).href);
const { EMPTY_FORM, createPart, updatePart, markPartScanned, filterParts, getDashboard, parseStoredParts } = model;
const createdAt = new Date("2026-09-19T12:00:00.000Z");
const later = new Date("2026-09-20T12:00:00.000Z");
const form = (overrides: Partial<PartForm> = {}): PartForm => ({ ...EMPTY_FORM, pcba: "PCBA-001", ...overrides });
const part = (overrides: Partial<PartForm> = {}, date = createdAt) => createPart([], form(overrides), date);
const stored = (value: unknown) => parseStoredParts(JSON.stringify(value));

test("creates pending ON records, trims input and does not mutate its arguments", () => {
  const input = form({ pcba: " PCBA-001 ", tecnico: " Ana " });
  const parts: Part[] = [];
  const result = createPart(parts, input, createdAt);
  assert.equal(result.pcba, "PCBA-001");
  assert.equal(result.tecnico, "Ana");
  assert.equal(result.statusSite, "NÃO BIPADO NO SITE");
  assert.equal(result.siteScannedAt, null);
  assert.equal(result.createdAt, createdAt.toISOString());
  assert.equal(result.updatedAt, result.createdAt);
  assert.ok(result.id);
  assert.equal(input.pcba, " PCBA-001 ");
  assert.deepEqual(parts, []);
});

test("rejects empty PCBA and duplicates while a code is pending", () => {
  assert.throws(() => createPart([], form({ pcba: " \n " })), /Informe o código/);
  const pending = part();
  for (const categoria of ["PEÇAS ON", "PEÇAS OFF"] as const) {
    assert.throws(() => createPart([pending], form({ pcba: " pcba-001 ", categoria })), /já está pendente/);
  }
  const scanned = markPartScanned([pending], pending.id, later);
  assert.equal(createPart([scanned], form()).statusSite, "NÃO BIPADO NO SITE");
});

test("OFF records have no site state and cannot be marked scanned", () => {
  const off = part({ categoria: "PEÇAS OFF" });
  assert.equal(off.statusSite, "");
  assert.equal(off.siteScannedAt, null);
  assert.throws(() => markPartScanned([off], off.id), /Somente peças ON/);
  assert.equal(getDashboard([off], createdAt).naoBipado, 0);
});

test("site scan is idempotent and preserves the original scan timestamp", () => {
  const pending = part();
  const scanned = markPartScanned([pending], pending.id, later);
  assert.equal(scanned.statusSite, "BIPADA");
  assert.equal(scanned.siteScannedAt, later.toISOString());
  assert.equal(scanned.updatedAt, later.toISOString());
  assert.deepEqual(markPartScanned([scanned], scanned.id, new Date("2026-09-25T12:00:00Z")), scanned);
  assert.equal(pending.statusSite, "NÃO BIPADO NO SITE");
});

test("editing preserves scan state within the same category and resets it across ON/OFF", () => {
  const pending = part();
  const scanned = markPartScanned([pending], pending.id, later);
  const edited = updatePart([scanned], scanned.id, form({ descricao: "FPC DANIFICADO" }), later);
  assert.equal(edited.statusSite, "BIPADA");
  assert.equal(edited.siteScannedAt, scanned.siteScannedAt);
  assert.equal(edited.createdAt, pending.createdAt);
  const off = updatePart([edited], edited.id, form({ categoria: "PEÇAS OFF" }), later);
  assert.equal(off.statusSite, "");
  assert.equal(off.siteScannedAt, null);
  const onAgain = updatePart([off], off.id, form(), later);
  assert.equal(onAgain.statusSite, "NÃO BIPADO NO SITE");
  assert.equal(onAgain.siteScannedAt, null);
});

test("editing ignores the current ID but rejects a PCBA pending in another record", () => {
  const first = part();
  const second = part({ pcba: "PCBA-002", categoria: "PEÇAS OFF" });
  assert.equal(updatePart([first], first.id, form()).id, first.id);
  assert.throws(() => updatePart([first, second], second.id, form()), /já está pendente/);
  assert.throws(() => updatePart([first], first.id, form({ pcba: "" })), /Informe o código/);
  assert.throws(() => updatePart([first], "missing", form()), /não encontrado/);
  assert.throws(() => markPartScanned([first], "missing"), /não encontrado/);
});

test("editing a scanned historical entry is allowed while a new entry with the same PCBA is pending", () => {
  const first = part();
  const scanned = markPartScanned([first], first.id, later);
  const nextEntry = createPart([scanned], form(), later);
  const history = updatePart([scanned, nextEntry], scanned.id, form({ tecnico: "Ana" }), later);
  assert.equal(history.tecnico, "Ana");
  assert.equal(history.siteScannedAt, scanned.siteScannedAt);
  const off = updatePart([history, nextEntry], history.id, form({ categoria: "PEÇAS OFF" }), later);
  assert.throws(() => updatePart([off, nextEntry], off.id, form(), later), /já está pendente/);
});

test("filters combine search, category and scan state and sort newest first without mutation", () => {
  const first = part({ tecnico: "João", descricao: "Análise da câmera" });
  const second = part({ pcba: "PCBA-002", categoria: "PEÇAS OFF", observacao: "Câmera reserva" }, later);
  const parts = [first, second];
  assert.deepEqual(filterParts(parts, { search: " CAMERA " }).map(item => item.id), [second.id, first.id]);
  assert.deepEqual(filterParts(parts, { search: "joao", categoria: "PEÇAS ON", statusSite: "NÃO BIPADO NO SITE" }), [first]);
  assert.deepEqual(filterParts(parts, { categoria: "TODAS", statusSite: "TODOS" }), [second, first]);
  assert.deepEqual(filterParts(parts, { categoria: "PEÇAS OFF", statusSite: "BIPADA" }), []);
  assert.deepEqual(parts, [first, second]);
});

test("daily and monthly dashboard counters use the same São Paulo calendar at UTC boundaries", () => {
  const dates = ["2026-09-01T02:59:59Z", "2026-09-01T03:00:00Z", "2026-10-01T02:00:00Z", "2026-10-01T03:00:00Z"];
  const parts = dates.map((date, index) => {
    const entry = part({ pcba: `PCBA-${index}` }, new Date(date));
    return markPartScanned([entry], entry.id, new Date(date));
  });
  const dashboard = getDashboard(parts, new Date("2026-10-01T02:30:00Z"));
  assert.equal(dashboard.hoje, 1);
  assert.equal(dashboard.resolvedToday, 1);
  assert.equal(dashboard.resolvedThisMonth, 2);
  assert.equal(dashboard.resolvedByDay.length, 30);
  assert.equal(dashboard.resolvedByDay[0].count, 1);
  assert.equal(dashboard.resolvedByDay[29].count, 1);
  assert.equal(dashboard.resolvedByDay.reduce((sum, day) => sum + day.count, 0), dashboard.resolvedThisMonth);
  const october = getDashboard(parts, new Date("2026-10-01T03:30:00Z"));
  assert.equal(october.resolvedByDay.length, 31);
  assert.equal(october.resolvedToday, 1);
  assert.equal(october.resolvedThisMonth, 1);
});

test("dashboard reports repair distribution, category totals and leap-year days", () => {
  const on = part({ statusReparo: "REPARO" });
  const off = part({ pcba: "PCBA-002", categoria: "PEÇAS OFF", statusReparo: "ANALISE" });
  const dashboard = getDashboard([on, off], createdAt);
  assert.deepEqual({ total: dashboard.total, on: dashboard.on, off: dashboard.off, naoBipado: dashboard.naoBipado, bipado: dashboard.bipado, reparo: dashboard.reparo, analise: dashboard.analise },
    { total: 2, on: 1, off: 1, naoBipado: 1, bipado: 0, reparo: 1, analise: 1 });
  assert.deepEqual(dashboard.statusCounts, { REPARO: 1, ANALISE: 1 });
  assert.equal(getDashboard([], new Date("2028-02-15T12:00:00Z")).resolvedByDay.length, 29);
});

test("stored records round-trip including metadata and empty OFF status", () => {
  const on = part();
  const off = part({ pcba: "PCBA-002", categoria: "PEÇAS OFF" });
  const scanned = markPartScanned([on], on.id, later);
  const value = [{ ...scanned, customMetadata: "preserved" }, off];
  assert.deepEqual(stored(value), value);
  assert.deepEqual(stored([]), []);
});

test("storage rejects malformed JSON, invalid fields, dates and inconsistent scan state as a whole", () => {
  const valid = part();
  assert.throws(() => parseStoredParts("{"), /JSON válido/);
  assert.throws(() => stored({ parts: [valid] }), /lista de peças/);
  const invalidEntries = [null, [], {}, { ...valid, pcba: " " }, { ...valid, tecnico: null },
    { ...valid, createdAt: "yesterday" }, { ...valid, updatedAt: "2026-09-19" },
    { ...valid, createdAt: "2026-02-30T12:00:00Z" },
    { ...valid, categoria: "OTHER" }, { ...valid, statusSite: "BIPADA" },
    { ...valid, statusSite: "OUTRO" }, { ...valid, categoria: "PEÇAS OFF" },
    { ...valid, siteScannedAt: later.toISOString() }];
  for (const invalid of invalidEntries) {
    const candidate = invalid && !Array.isArray(invalid) ? { ...invalid, id: "invalid" } : invalid;
    assert.throws(() => stored([valid, candidate]), /Registro 2 inválido/);
  }
});

test("storage rejects duplicate IDs and pending PCBAs, but allows repeat codes after scanning", () => {
  const first = part();
  assert.throws(() => stored([first, first]), /identificador ausente ou repetido/);
  assert.throws(() => stored([first, { ...first, id: "another-id", pcba: " pcba-001 " }]), /PCBA repetida/);
  const scanned = markPartScanned([first], first.id, later);
  assert.equal(stored([scanned, part()]).length, 2);
});
