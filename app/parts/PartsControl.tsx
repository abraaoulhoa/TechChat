"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Part, PartForm } from "./parts-model";
import "./parts.css";

type PartOptions = {
  categorias: string[];
  statusReparo: string[];
  statusSite: string[];
  origem: string[];
  descricoes: string[];
  modelos: string[];
};

type PartsResponse = {
  parts: Part[];
  options: PartOptions;
  dashboard: {
    total: number;
    hoje: number;
    off: number;
    on: number;
    naoBipado: number;
    bipado: number;
    resolvedToday: number;
    resolvedThisMonth: number;
    statusCounts: Record<string, number>;
    resolvedByDay: { day: number; count: number }[];
  };
};

const emptyForm: PartForm = {
  categoria: "PEÇAS ON",
  pcba: "",
  descricao: "",
  statusReparo: "LINHA",
  origem: "AOI",
  modelo: "",
  tecnico: "",
  observacao: "",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error(
        "O banco compartilhado está indisponível. Tente novamente em instantes; se o problema continuar, peça ao administrador para verificar a conexão.",
      );
    }
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "Não foi possível concluir a operação. Tente novamente.",
    );
  }
  if (!payload) throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
  return payload;
}

function formFromPart(part: Part): PartForm {
  return {
    categoria: part.categoria,
    pcba: part.pcba,
    descricao: part.descricao,
    statusReparo: part.statusReparo,
    origem: part.origem,
    modelo: part.modelo,
    tecnico: part.tecnico,
    observacao: part.observacao,
  };
}

export default function PartsControl({
  query = "",
  onBack,
}: {
  query?: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<PartsResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [form, setForm] = useState<PartForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("TODAS");
  const [siteStatus, setSiteStatus] = useState("TODOS");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<Part | null>(null);
  const [editForm, setEditForm] = useState<PartForm>(emptyForm);
  const [deleting, setDeleting] = useState<Part | null>(null);
  const [dialogError, setDialogError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mutationRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    if (mutationRef.current && !force) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    setRefreshing(true);
    const timeout = window.setTimeout(() => controller.abort("timeout"), 20_000);
    try {
      const response = await fetch("/api/parts", {
        cache: "no-store",
        signal: controller.signal,
      });
      const next = (await readResponse(response)) as PartsResponse;
      if (!Array.isArray(next.parts) || !next.dashboard || !next.options) {
        throw new Error("Não foi possível carregar os registros. Tente novamente.");
      }
      if (!mountedRef.current || generation !== generationRef.current) return;
      setData(next);
      setLoadError("");
      setLastUpdated(new Date());
    } catch (error) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setLoadError(
        controller.signal.reason === "timeout"
          ? "A conexão demorou mais que o esperado. Verifique sua internet e tente novamente."
          : error instanceof TypeError
            ? "Não foi possível acessar os registros compartilhados. Verifique sua conexão e tente novamente."
            : error instanceof Error
              ? error.message
              : "Não foi possível carregar os registros. Tente novamente.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (mountedRef.current && generation === generationRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initial = window.setTimeout(() => void load(), 0);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const poll = window.setInterval(refreshVisible, 15_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(initial);
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      requestRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (editing) editDialog.current?.showModal();
    else editDialog.current?.close();
  }, [editing]);

  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleting]);

  const filteredParts = useMemo(() => {
    const terms = [query, search].map(normalizeSearch).map((value) => value.trim()).filter(Boolean);
    return (data?.parts ?? [])
      .filter((part) => {
        if (category !== "TODAS" && part.categoria !== category) return false;
        if (siteStatus === "NAO_APLICA" && part.categoria !== "PEÇAS OFF") return false;
        if (siteStatus !== "TODOS" && siteStatus !== "NAO_APLICA" && part.statusSite !== siteStatus) return false;
        const searchable = normalizeSearch(
          [part.pcba, part.descricao, part.statusReparo, part.statusSite, part.origem, part.modelo, part.tecnico, part.observacao, part.categoria].join(" "),
        );
        return terms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [category, data, query, search, siteStatus]);

  async function mutate(
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body: PartForm | undefined,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (mutationRef.current) return;
    mutationRef.current = true;
    requestRef.current?.abort();
    generationRef.current += 1;
    setRefreshing(false);
    setBusy(key);
    setFeedback(null);
    setDialogError("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await readResponse(response);
      if (!mountedRef.current) return;
      onSuccess?.();
      setFeedback({ kind: "success", message: successMessage });
      await load(true);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof TypeError
        ? "Não foi possível confirmar a operação. Atualize os registros antes de tentar novamente."
        : error instanceof Error ? error.message : "Não foi possível concluir a operação.";
      setFeedback({ kind: "error", message });
      if (key.startsWith("edit-") || key.startsWith("delete-")) setDialogError(message);
    } finally {
      mutationRef.current = false;
      if (mountedRef.current) setBusy("");
    }
  }

  function savePart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate("create", "/api/parts", "POST", form, `PCBA ${form.pcba.trim()} registrada.`, () => {
      setForm((previous) => ({
        ...emptyForm,
        categoria: previous.categoria,
        modelo: previous.modelo,
        tecnico: previous.tecnico,
        origem: previous.origem,
      }));
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function openEdit(part: Part) {
    setDialogError("");
    setEditForm(formFromPart(part));
    setEditing(part);
  }

  const dashboard = data?.dashboard;
  const statusEntries = Object.entries(dashboard?.statusCounts ?? {}).sort((a, b) => b[1] - a[1]);
  const statusMax = Math.max(1, ...statusEntries.map(([, count]) => count));
  const monthMax = Math.max(1, ...(dashboard?.resolvedByDay ?? []).map((day) => day.count));
  const hasFilters = Boolean(search || query || category !== "TODAS" || siteStatus !== "TODOS");

  return (
    <div className="parts-control">
      <div className="parts-heading">
        <div className="parts-heading-copy">
          <button className="parts-back" type="button" onClick={onBack}><ArrowLeft size={15} /> Voltar para OPPO</button>
          <h2>Controle de peças</h2>
          <p>Bipagem, pendências e histórico da equipe em um só lugar.</p>
        </div>
        <div className="parts-sync">
          <span><i aria-hidden="true" className={loadError ? "parts-sync-warning" : ""} />{loadError ? "Atualização pendente" : "Compartilhado com a equipe"}</span>
          {lastUpdated && <small>Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
          <button type="button" className="parts-button parts-button-subtle" onClick={() => void load()} disabled={refreshing || Boolean(busy)}>
            <RefreshCw size={14} className={refreshing ? "parts-spinning" : ""} />{refreshing ? "Atualizando" : "Atualizar"}
          </button>
        </div>
      </div>

      {feedback && <div className={`parts-feedback parts-feedback-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
        {feedback.kind === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
        <span>{feedback.message}</span>
        <button type="button" aria-label="Fechar mensagem" onClick={() => setFeedback(null)}><X size={16} /></button>
      </div>}

      {loadError && <div className="parts-feedback parts-feedback-error" role="alert">
        <AlertCircle size={18} /><div><strong>{data ? "Os dados podem estar desatualizados." : "Não foi possível carregar o controle de peças."}</strong><span>{loadError}</span></div>
        <button type="button" className="parts-retry" onClick={() => void load()} disabled={refreshing || Boolean(busy)}>{refreshing ? "Tentando…" : "Tentar novamente"}</button>
      </div>}

      {!data ? <section className="parts-state parts-panel" aria-busy={refreshing}>
        {refreshing ? <LoaderCircle size={30} className="parts-spinning" /> : <Package size={30} />}
        <h3>{refreshing ? "Carregando registros compartilhados" : "Aguardando conexão com os registros"}</h3>
        <p>{refreshing ? "Consultando as peças e os indicadores da equipe." : "Os indicadores aparecerão assim que os dados forem carregados."}</p>
      </section> : <>
        <section className="parts-stats" aria-label="Resumo de todas as peças">
          <Stat label="Entradas hoje" value={data.dashboard.hoje} icon={<Barcode size={18} />} />
          <Stat label="Peças OFF" value={data.dashboard.off} icon={<Package size={18} />} />
          <Stat label="Peças ON" value={data.dashboard.on} icon={<Package size={18} />} />
          <Stat label="Pendentes no site" value={data.dashboard.naoBipado} tone="pending" icon={<Clock3 size={18} />} />
          <Stat label="Bipadas no site" value={data.dashboard.bipado} tone="done" icon={<CheckCircle2 size={18} />} />
        </section>

        <div className="parts-main-grid">
          <section className="parts-panel parts-entry" aria-labelledby="parts-entry-title">
            <div className="parts-panel-heading"><span className="parts-panel-icon"><Barcode size={19} /></span><div><h3 id="parts-entry-title">Bipagem rápida</h3><p>Registre uma peça na bancada</p></div></div>
            <form onSubmit={savePart}>
              <fieldset disabled={Boolean(busy)}>
                <PartFields form={form} onChange={setForm} options={data.options} prefix="parts-create" inputRef={inputRef} />
                <div className="parts-form-note"><Clock3 size={15} /><span>{form.categoria === "PEÇAS ON" ? "Peças ON entram como pendentes de bipagem no site." : "Peças OFF não exigem bipagem no site."}</span></div>
                <button className="parts-button parts-button-primary parts-submit" type="submit" disabled={!form.pcba.trim()}>
                  {busy === "create" ? <LoaderCircle size={17} className="parts-spinning" /> : <Barcode size={17} />}
                  {busy === "create" ? "Salvando registro…" : "Salvar registro"}
                </button>
              </fieldset>
            </form>
          </section>

          <section className="parts-panel parts-records" aria-labelledby="parts-records-title">
            <div className="parts-records-heading"><div><h3 id="parts-records-title">Peças e histórico</h3><p>{filteredParts.length} {filteredParts.length === 1 ? "registro" : "registros"}{hasFilters ? ` de ${data.parts.length}` : " no total"}</p></div><span className="parts-count">{data.dashboard.total}</span></div>
            <div className="parts-filters">
              <label className="parts-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar nos registros de peças" placeholder="PCBA, falha, modelo, técnico…" /></label>
              <div className="parts-filter-selects">
                <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="TODAS">Todas as peças</option><option>PEÇAS ON</option><option>PEÇAS OFF</option></select></label>
                <label><span>Bipagem no site</span><select value={siteStatus} onChange={(event) => setSiteStatus(event.target.value)}><option value="TODOS">Todos os status</option><option value="NÃO BIPADO NO SITE">Pendentes</option><option value="BIPADA">Bipadas</option><option value="NAO_APLICA">Não se aplica (OFF)</option></select></label>
              </div>
            </div>
            {query.trim() && <p className="parts-global-search">Pesquisa geral aplicada: <strong>{query}</strong></p>}
            {filteredParts.length === 0 ? <div className="parts-empty"><Package size={32} /><h4>{hasFilters ? "Nenhuma peça encontrada" : "Pronto para a primeira peça"}</h4><p>{hasFilters ? "Revise a busca e os filtros para encontrar outros registros." : "Bipe ou digite uma PCBA no formulário para iniciar o controle."}</p>{hasFilters && <button type="button" className="parts-button parts-button-subtle" onClick={() => { setSearch(""); setCategory("TODAS"); setSiteStatus("TODOS"); }}>Limpar filtros desta seção</button>}</div> : <div className="parts-table-scroll" role="region" aria-label="Histórico de peças, role horizontalmente para ver todas as colunas" tabIndex={0}>
              <table className="parts-table"><thead><tr><th scope="col">Peça / PCBA</th><th scope="col">Falha / origem</th><th scope="col">Status</th><th scope="col">Entrada</th><th scope="col">Ações</th></tr></thead><tbody>
                {filteredParts.map((part) => <tr key={part.id}>
                  <td><span className={`parts-category ${part.categoria === "PEÇAS ON" ? "parts-category-on" : ""}`}>{part.categoria}</span><strong className="parts-pcba">{part.pcba}</strong><span className="parts-cell-secondary">{part.modelo || "Modelo não informado"}</span>{part.tecnico && <span className="parts-cell-secondary">{part.tecnico}</span>}</td>
                  <td><span className="parts-description">{part.descricao || "Sem descrição"}</span><span className="parts-cell-secondary">{part.origem}</span>{part.observacao && <details className="parts-observation"><summary>Observação <ChevronDown size={12} /></summary><p>{part.observacao}</p></details>}</td>
                  <td><span className="parts-repair-status">{part.statusReparo}</span>{part.categoria === "PEÇAS OFF" ? <span className="parts-site parts-site-off">Site: não se aplica</span> : <span className={`parts-site ${part.statusSite === "NÃO BIPADO NO SITE" ? "parts-site-pending" : "parts-site-done"}`}>{part.statusSite === "NÃO BIPADO NO SITE" ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}{part.statusSite === "NÃO BIPADO NO SITE" ? "Pendente no site" : "Bipada no site"}</span>}{part.siteScannedAt && <span className="parts-cell-secondary">{formatDate(part.siteScannedAt)}</span>}</td>
                  <td className="parts-date"><time dateTime={part.createdAt}>{formatDate(part.createdAt)}</time></td>
                  <td><div className="parts-row-actions">{part.statusSite === "NÃO BIPADO NO SITE" && part.categoria === "PEÇAS ON" && <button type="button" className="parts-button parts-mark" disabled={Boolean(busy)} onClick={() => void mutate(`scan-${part.id}`, `/api/parts/${encodeURIComponent(part.id)}/scan`, "POST", undefined, `PCBA ${part.pcba} marcada como bipada.`)}>{busy === `scan-${part.id}` ? <LoaderCircle size={14} className="parts-spinning" /> : <CheckCircle2 size={14} />} Bipada</button>}<div className="parts-icon-actions"><button type="button" className="parts-action-icon" title={`Editar ${part.pcba}`} aria-label={`Editar PCBA ${part.pcba}`} disabled={Boolean(busy)} onClick={() => openEdit(part)}><Pencil size={15} /></button><button type="button" className="parts-action-icon parts-action-danger" title={`Excluir ${part.pcba}`} aria-label={`Excluir PCBA ${part.pcba}`} disabled={Boolean(busy)} onClick={() => { setDialogError(""); setDeleting(part); }}><Trash2 size={15} /></button></div></div></td>
                </tr>)}
              </tbody></table>
            </div>}
            <div className="parts-table-footer"><span><RefreshCw size={12} /> Atualização automática a cada 15 segundos</span><span>Mais recentes primeiro</span></div>
          </section>
        </div>

        <section className="parts-panel parts-dashboard" aria-labelledby="parts-dashboard-title">
          <div className="parts-records-heading"><div><h3 id="parts-dashboard-title">Dashboard de resoluções</h3><p>Visão de todas as peças, independente dos filtros.</p></div><span className="parts-month">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span></div>
          <div className="parts-resolution-stats"><div><span>Resolvidas hoje</span><strong>{data.dashboard.resolvedToday}</strong></div><div><span>Resolvidas no mês</span><strong>{data.dashboard.resolvedThisMonth}</strong></div><div><span>Total bipado no site</span><strong>{data.dashboard.bipado}</strong></div></div>
          <div className="parts-charts">
            <div className="parts-status-chart"><h4>Status de reparo</h4>{statusEntries.length === 0 ? <p className="parts-chart-empty">Os status aparecerão após o primeiro registro.</p> : <ul>{statusEntries.map(([status, count]) => <li key={status}><div><span>{status}</span><strong>{count}</strong></div><div className="parts-status-track" aria-hidden="true"><span style={{ width: `${count / statusMax * 100}%` }} /></div></li>)}</ul>}</div>
            <div className="parts-month-chart"><h4>Resoluções no mês</h4><p>Peças marcadas como bipadas no site por dia.</p><div className="parts-day-chart" role="img" aria-label={`Resoluções por dia do mês: ${data.dashboard.resolvedByDay.map(({ day, count }) => `dia ${day}: ${count}`).join("; ")}`}>
              {data.dashboard.resolvedByDay.map(({ day, count }) => <div className="parts-day" key={day} title={`Dia ${day}: ${count} ${count === 1 ? "resolução" : "resoluções"}`}><div className="parts-day-track"><span className={count === 0 ? "parts-day-zero" : ""} style={{ height: count === 0 ? "2px" : `${Math.max(4, count / monthMax * 100)}%` }} /></div><small>{day}</small></div>)}
            </div><div className="parts-chart-key"><i aria-hidden="true" /> Bipagens concluídas{data.dashboard.resolvedThisMonth === 0 && <span>Nenhuma resolução neste mês</span>}</div></div>
          </div>
        </section>

        <dialog className="parts-dialog" ref={editDialog} aria-labelledby="parts-edit-title" onCancel={(event) => { if (busy) event.preventDefault(); else setEditing(null); }} onClose={() => setEditing(null)}>
          <div className="parts-dialog-heading"><div><h3 id="parts-edit-title">Editar peça</h3><p>Atualize os dados do registro compartilhado.</p></div><button type="button" className="parts-action-icon" aria-label="Fechar edição" disabled={Boolean(busy)} onClick={() => setEditing(null)}><X size={19} /></button></div>
          <form onSubmit={(event) => { event.preventDefault(); if (editing) void mutate(`edit-${editing.id}`, `/api/parts/${encodeURIComponent(editing.id)}`, "PATCH", editForm, `PCBA ${editForm.pcba.trim()} atualizada.`, () => setEditing(null)); }}>
            <fieldset disabled={Boolean(busy)}><PartFields form={editForm} onChange={setEditForm} options={data.options} prefix="parts-edit" /><p className="parts-form-hint">Ao mudar para OFF, a bipagem no site deixa de se aplicar. Ao mudar para ON, a peça fica pendente.</p>{dialogError && <p className="parts-dialog-error" role="alert">{dialogError}</p>}<div className="parts-dialog-actions"><button className="parts-button parts-button-subtle" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="parts-button parts-button-primary" type="submit" disabled={!editForm.pcba.trim()}>{busy.startsWith("edit-") && <LoaderCircle size={15} className="parts-spinning" />}{busy.startsWith("edit-") ? "Salvando…" : "Salvar alterações"}</button></div></fieldset>
          </form>
        </dialog>

        <dialog className="parts-dialog parts-delete-dialog" ref={deleteDialog} aria-labelledby="parts-delete-title" aria-describedby="parts-delete-description" onCancel={(event) => { if (busy) event.preventDefault(); else setDeleting(null); }} onClose={() => setDeleting(null)}>
          <div className="parts-delete-icon"><Trash2 size={23} /></div><h3 id="parts-delete-title">Excluir este registro?</h3><p id="parts-delete-description">A PCBA <strong>{deleting?.pcba}</strong> será removida do histórico de toda a equipe. Esta ação não pode ser desfeita.</p>{dialogError && <p className="parts-dialog-error" role="alert">{dialogError}</p>}<div className="parts-dialog-actions"><button type="button" className="parts-button parts-button-subtle" disabled={Boolean(busy)} onClick={() => setDeleting(null)} autoFocus>Cancelar</button><button type="button" className="parts-button parts-button-danger" disabled={Boolean(busy)} onClick={() => { if (deleting) void mutate(`delete-${deleting.id}`, `/api/parts/${encodeURIComponent(deleting.id)}`, "DELETE", undefined, `Registro da PCBA ${deleting.pcba} excluído.`, () => setDeleting(null)); }}>{busy.startsWith("delete-") ? <LoaderCircle size={15} className="parts-spinning" /> : <Trash2 size={15} />}{busy.startsWith("delete-") ? "Excluindo…" : "Excluir registro"}</button></div>
        </dialog>
      </>}
    </div>
  );
}

function Stat({ label, value, icon, tone = "" }: { label: string; value: number; icon: React.ReactNode; tone?: string }) {
  return <div className={`parts-stat ${tone ? `parts-stat-${tone}` : ""}`}><div><span>{label}</span><i aria-hidden="true">{icon}</i></div><strong>{value}</strong></div>;
}

function PartFields({
  form,
  onChange,
  options,
  prefix,
  inputRef,
}: {
  form: PartForm;
  onChange: React.Dispatch<React.SetStateAction<PartForm>>;
  options: PartOptions;
  prefix: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const change = (key: keyof PartForm, value: string) => onChange((previous) => ({ ...previous, [key]: value }));
  const statuses = Array.from(new Set([...options.statusReparo, form.statusReparo]));
  const origins = Array.from(new Set([...options.origem, form.origem]));
  return <div className="parts-fields">
    <div className="parts-categories" role="group" aria-label="Categoria da peça">{["PEÇAS ON", "PEÇAS OFF"].map((value) => <button type="button" key={value} className={form.categoria === value ? "is-selected" : ""} aria-pressed={form.categoria === value} onClick={() => change("categoria", value)}><span className={value === "PEÇAS ON" ? "parts-category-dot-on" : "parts-category-dot-off"} />{value}</button>)}</div>
    <label htmlFor={`${prefix}-pcba`}>PCBA <span className="parts-required">*</span><input id={`${prefix}-pcba`} ref={inputRef} value={form.pcba} onChange={(event) => change("pcba", event.target.value)} placeholder="Bipe ou digite o código" autoComplete="off" required maxLength={200} /></label>
    <label htmlFor={`${prefix}-description`}>Descrição da falha<input id={`${prefix}-description`} list={`${prefix}-descriptions`} value={form.descricao} onChange={(event) => change("descricao", event.target.value)} placeholder="Descreva ou selecione uma falha" maxLength={2000} /></label>
    <datalist id={`${prefix}-descriptions`}>{options.descricoes.map((description) => <option key={description} value={description} />)}</datalist>
    <div className="parts-field-pair"><label htmlFor={`${prefix}-status`}>Status de reparo<select id={`${prefix}-status`} value={form.statusReparo} onChange={(event) => change("statusReparo", event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label htmlFor={`${prefix}-origin`}>Origem / setor<select id={`${prefix}-origin`} value={form.origem} onChange={(event) => change("origem", event.target.value)}>{origins.map((origin) => <option key={origin}>{origin}</option>)}</select></label></div>
    <div className="parts-field-pair"><label htmlFor={`${prefix}-model`}>Modelo<input id={`${prefix}-model`} list={`${prefix}-models`} value={form.modelo} onChange={(event) => change("modelo", event.target.value)} placeholder="Opcional" maxLength={200} /></label><label htmlFor={`${prefix}-technician`}>Técnico<input id={`${prefix}-technician`} value={form.tecnico} onChange={(event) => change("tecnico", event.target.value)} placeholder="Opcional" maxLength={200} /></label></div>
    <datalist id={`${prefix}-models`}>{options.modelos.map((model) => <option key={model} value={model} />)}</datalist>
    <label htmlFor={`${prefix}-notes`}>Observação<textarea id={`${prefix}-notes`} value={form.observacao} onChange={(event) => change("observacao", event.target.value)} rows={2} placeholder="Informações adicionais (opcional)" maxLength={4000} /></label>
  </div>;
}
