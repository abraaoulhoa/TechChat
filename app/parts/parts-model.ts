export type Part = {
  id: string;
  categoria: "PEÇAS ON" | "PEÇAS OFF";
  pcba: string;
  descricao: string;
  statusReparo: string;
  statusSite: "NÃO BIPADO NO SITE" | "BIPADA" | "";
  origem: string;
  modelo: string;
  tecnico: string;
  observacao: string;
  createdAt: string;
  siteScannedAt: string | null;
  updatedAt: string;
};

export type PartForm = Omit<Part, "id" | "statusSite" | "createdAt" | "siteScannedAt" | "updatedAt">;

export const EMPTY_FORM: PartForm = {
  categoria: "PEÇAS ON",
  pcba: "",
  descricao: "",
  statusReparo: "LINHA",
  origem: "AOI",
  modelo: "",
  tecnico: "",
  observacao: "",
};

export const OPTIONS = {
  categorias: ["PEÇAS ON", "PEÇAS OFF"],
  statusReparo: ["LINHA", "PRODUTO", "ANALISE", "REPARO", "AGUARDANDO ENGENHARIA"],
  statusSite: ["NÃO BIPADO NO SITE", "BIPADA"],
  origem: ["AOI", "Disassembly", "Battery Cover", "Mainboard"],
  modelos: ["A6X 5G - 256G", "A6X 5G - 128G", "A6T"],
  descricoes: [
    "TEMPO EXCEDIDO DE COLA",
    "ALTO FALANTE DESALINHADO",
    "IMPUREZA NA CAMERA PRINCIPAL.",
    "J6903 E J6901 DANIFICADO",
    "FALHA NA APLICACAO DA COLA",
    "FALHA DE GPS, SWAP FEITO E FALHA MIGRA COM MAINBOARD (ANALISE)",
    "FPC DANIFICADO",
    "BATTERY COVER DESALINHADO",
    "CAMERA DESCONECTADA",
    "SLOT DO SIM CARD MAL POSICIONADO",
    "FPC DESCONECTADO.",
    "ERRO DE ROTA A5464",
  ],
} as const;

const PENDING = "NÃO BIPADO NO SITE";
const formTextKeys = ["pcba", "descricao", "statusReparo", "origem", "modelo", "tecnico", "observacao"] as const;

function normalizeForm(form: PartForm): PartForm {
  if (form.categoria !== "PEÇAS ON" && form.categoria !== "PEÇAS OFF") {
    throw new Error("Selecione PEÇAS ON ou PEÇAS OFF.");
  }
  for (const key of formTextKeys) {
    if (typeof form[key] !== "string") throw new Error(`Campo inválido: ${key}.`);
  }
  if (!form.pcba.trim()) throw new Error("Informe o código/PCBA.");
  if (!form.statusReparo.trim() || !form.origem.trim()) throw new Error("Informe o status de reparo e a origem.");
  return {
    categoria: form.categoria,
    pcba: form.pcba.trim(),
    descricao: form.descricao.trim(),
    statusReparo: form.statusReparo.trim(),
    origem: form.origem.trim(),
    modelo: form.modelo.trim(),
    tecnico: form.tecnico.trim(),
    observacao: form.observacao.trim(),
  };
}

function pcbaKey(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function ensureNoPendingDuplicate(parts: readonly Part[], pcba: string, exceptId?: string) {
  if (parts.some(part => part.id !== exceptId && part.statusSite === PENDING && pcbaKey(part.pcba) === pcbaKey(pcba))) {
    throw new Error("Essa PCBA já está pendente de bipagem no site.");
  }
}

function findPart(parts: readonly Part[], id: string) {
  const part = parts.find(item => item.id === id);
  if (!part) throw new Error("Registro não encontrado.");
  return part;
}

export function createPart(parts: readonly Part[], form: PartForm, now = new Date()): Part {
  const normalized = normalizeForm(form);
  ensureNoPendingDuplicate(parts, normalized.pcba);
  const timestamp = now.toISOString();
  return {
    ...normalized,
    id: crypto.randomUUID(),
    statusSite: normalized.categoria === "PEÇAS ON" ? PENDING : "",
    createdAt: timestamp,
    siteScannedAt: null,
    updatedAt: timestamp,
  };
}

export function updatePart(parts: readonly Part[], id: string, form: PartForm, now = new Date()): Part {
  const previous = findPart(parts, id);
  const normalized = normalizeForm(form);
  const sameCategory = previous.categoria === normalized.categoria;
  const statusSite = sameCategory ? previous.statusSite : normalized.categoria === "PEÇAS ON" ? PENDING : "";
  if (statusSite === PENDING || pcbaKey(previous.pcba) !== pcbaKey(normalized.pcba)) {
    ensureNoPendingDuplicate(parts, normalized.pcba, id);
  }
  return {
    ...previous,
    ...normalized,
    statusSite,
    siteScannedAt: sameCategory ? previous.siteScannedAt : null,
    updatedAt: now.toISOString(),
  };
}

export function markPartScanned(parts: readonly Part[], id: string, now = new Date()): Part {
  const previous = findPart(parts, id);
  if (previous.categoria !== "PEÇAS ON") throw new Error("Somente peças ON podem ser bipadas no site.");
  if (previous.statusSite === "BIPADA") return previous;
  const timestamp = now.toISOString();
  return { ...previous, statusSite: "BIPADA", siteScannedAt: timestamp, updatedAt: timestamp };
}

export type PartFilters = { search?: string; categoria?: string; statusSite?: string };

function searchKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function hasFilter(value?: string) {
  return Boolean(value && !["todas", "todos"].includes(searchKey(value)));
}

export function filterParts(parts: readonly Part[], { search = "", categoria, statusSite }: PartFilters = {}): Part[] {
  const query = searchKey(search);
  return parts.filter(part => {
    if (hasFilter(categoria) && part.categoria !== categoria) return false;
    if (hasFilter(statusSite) && part.statusSite !== statusSite) return false;
    return !query || [part.pcba, part.descricao, part.modelo, part.statusReparo, part.statusSite, part.origem, part.tecnico, part.observacao]
      .some(value => searchKey(value).includes(query));
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// Use the same business calendar for every counter, including UTC midnight boundaries.
export const PARTS_TIME_ZONE = "America/Sao_Paulo";
const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PARTS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function calendarDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const fields = calendarFormatter.formatToParts(date);
  const year = Number(fields.find(field => field.type === "year")?.value);
  const month = Number(fields.find(field => field.type === "month")?.value);
  const day = Number(fields.find(field => field.type === "day")?.value);
  return { year, month, day };
}

export function getDashboard(parts: readonly Part[], now = new Date()) {
  const today = calendarDate(now);
  const inMonth = (date: ReturnType<typeof calendarDate>) => date.year === today.year && date.month === today.month;
  const isToday = (date: ReturnType<typeof calendarDate>) => inMonth(date) && date.day === today.day;
  const resolvedByDay = Array.from({ length: new Date(Date.UTC(today.year, today.month, 0)).getUTCDate() }, (_, index) => ({ day: index + 1, count: 0 }));
  const statusCounts = new Map<string, number>();
  let hoje = 0;
  let resolvedToday = 0;
  let resolvedThisMonth = 0;
  for (const part of parts) {
    if (isToday(calendarDate(part.createdAt))) hoje += 1;
    statusCounts.set(part.statusReparo, (statusCounts.get(part.statusReparo) ?? 0) + 1);
    if (part.categoria === "PEÇAS ON" && part.statusSite === "BIPADA" && part.siteScannedAt) {
      const scannedDate = calendarDate(part.siteScannedAt);
      if (inMonth(scannedDate)) {
        resolvedThisMonth += 1;
        resolvedByDay[scannedDate.day - 1].count += 1;
      }
      if (isToday(scannedDate)) resolvedToday += 1;
    }
  }
  return {
    total: parts.length,
    hoje,
    off: parts.filter(part => part.categoria === "PEÇAS OFF").length,
    on: parts.filter(part => part.categoria === "PEÇAS ON").length,
    naoBipado: parts.filter(part => part.categoria === "PEÇAS ON" && part.statusSite === PENDING).length,
    bipado: parts.filter(part => part.categoria === "PEÇAS ON" && part.statusSite === "BIPADA").length,
    reparo: parts.filter(part => part.statusReparo === "REPARO").length,
    analise: parts.filter(part => part.statusReparo === "ANALISE").length,
    resolvedToday,
    resolvedThisMonth,
    statusCounts: Object.fromEntries(statusCounts) as Record<string, number>,
    resolvedByDay,
  };
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const fields = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!fields || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = fields.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]
    && hour < 24 && minute < 60 && second < 60;
}

export function parseStoredParts(raw: string): Part[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Os registros salvos não contêm um JSON válido.");
  }
  if (!Array.isArray(data)) throw new Error("Os registros salvos devem ser uma lista de peças.");
  const ids = new Set<string>();
  const pendingCodes = new Set<string>();
  for (const [index, candidate] of data.entries()) {
    const invalid = (detail: string): never => { throw new Error(`Registro ${index + 1} inválido: ${detail}.`); };
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) invalid("formato desconhecido");
    const part = candidate as Record<string, unknown>;
    if (typeof part.id !== "string" || !part.id.trim() || ids.has(part.id)) invalid("identificador ausente ou repetido");
    if (part.categoria !== "PEÇAS ON" && part.categoria !== "PEÇAS OFF") invalid("categoria desconhecida");
    for (const key of formTextKeys) {
      if (typeof part[key] !== "string") invalid(`campo ${key} ausente ou inválido`);
    }
    if (!(part.pcba as string).trim()) invalid("PCBA vazia");
    if (!(part.statusReparo as string).trim() || !(part.origem as string).trim()) invalid("status de reparo ou origem vazios");
    if (!isTimestamp(part.createdAt) || !isTimestamp(part.updatedAt)) invalid("data de criação ou alteração inválida");
    if (part.siteScannedAt !== null && !isTimestamp(part.siteScannedAt)) invalid("data de bipagem inválida");
    if (part.categoria === "PEÇAS OFF") {
      if (part.statusSite !== "" || part.siteScannedAt !== null) invalid("peças OFF não têm bipagem no site");
    } else if (part.statusSite === PENDING) {
      if (part.siteScannedAt !== null) invalid("peça pendente com data de bipagem");
      const code = pcbaKey(part.pcba as string);
      if (pendingCodes.has(code)) invalid("PCBA repetida entre peças pendentes");
      pendingCodes.add(code);
    } else if (part.statusSite === "BIPADA") {
      if (part.siteScannedAt === null) invalid("peça bipada sem data de bipagem");
    } else {
      invalid("status de bipagem desconhecido");
    }
    ids.add(part.id as string);
  }
  return data as Part[];
}
