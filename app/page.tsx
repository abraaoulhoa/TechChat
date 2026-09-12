"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Hash,
  Image as ImageIcon,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Users,
  Wrench,
  X,
  Megaphone,
  BookOpen,
  Moon,
  Sun,
} from "lucide-react";

type View = "board" | "notices" | "guide";
type Channel =
  | "geral"
  | "hardware"
  | "software"
  | "celulares"
  | "duvidas"
  | "urgentes";
type Msg = {
  id: number;
  name: string;
  initials: string;
  time: string;
  role: string;
  tag?: string;
  tone?: string;
  text: string;
  details?: string[];
  image?: string;
  likes?: number;
};

const channels: Record<Channel, string> = {
  geral: "Alinhamentos da equipe técnica",
  hardware: "Diagnósticos, medições e reparos em placa",
  software: "BIOS, sistema, drivers e ferramentas",
  celulares: "Análises e soluções para dispositivos móveis",
  duvidas: "Ajuda rápida entre técnicos",
  urgentes: "Falhas bloqueando a produção",
};
const appName = "TechChat";
const seed: Record<Channel, Msg[]> = {
  hardware: [
    {
      id: 1,
      name: "Carlos Lima",
      initials: "CL",
      time: "09:15",
      role: "Técnico II",
      tag: "DÚVIDA",
      tone: "blue",
      text: "Notebook não liga; LED de carga acende e apaga.",
      details: [
        "Equipamento: Notebook OPPO Book 14",
        "Testes: fonte validada, bateria removida e memória testada",
        "Consumo: 0,055 A em standby",
      ],
      likes: 3,
    },
    {
      id: 2,
      name: "Marcos Tech",
      initials: "MT",
      time: "09:27",
      role: "Técnico III",
      tag: "SOLUÇÃO",
      tone: "green",
      text: "Provável curto no PU4501. Já peguei este caso. Verifique também o capacitor PC4510.",
      details: [
        "Medição esperada: 3,3 V na bobina PL4501",
        "Se zerado, isole a linha antes da substituição",
      ],
      likes: 6,
    },
    {
      id: 3,
      name: "Rafael Costa",
      initials: "RC",
      time: "09:31",
      role: "Auxiliar técnico",
      text: "Confirmado. Substituí o capacitor e o equipamento voltou a ligar.",
      likes: 2,
    },
  ],
  software: [
    {
      id: 4,
      name: "Juliana Souza",
      initials: "JS",
      time: "08:48",
      role: "Técnica II",
      tag: "SOLUÇÃO",
      tone: "green",
      text: "Para o erro “Invalid signature detected”, desative o CSM antes de habilitar o Secure Boot.",
      likes: 8,
    },
  ],
  geral: [
    {
      id: 5,
      name: "Juliana Souza",
      initials: "JS",
      time: "08:10",
      role: "Liderança",
      text: "Bom dia, equipe! A bancada 4 já está liberada para uso.",
    },
  ],
  celulares: [
    {
      id: 6,
      name: "Rafael Costa",
      initials: "RC",
      time: "10:02",
      role: "Auxiliar técnico",
      tag: "DÚVIDA",
      tone: "blue",
      text: "RENO16 reinicia após a logo. Alguém já identificou essa falha?",
      likes: 1,
    },
  ],
  duvidas: [],
  urgentes: [
    {
      id: 7,
      name: "Carlos Lima",
      initials: "CL",
      time: "10:18",
      role: "Técnico II",
      tag: "URGENTE",
      tone: "red",
      text: "Linha parada: três unidades com consumo travado em 0,008 A. Preciso de apoio na bancada 2.",
    },
  ],
};
const notices = [
  {
    id: 1,
    type: "URGENTE",
    tone: "red",
    title: "Novo procedimento de diagnóstico",
    body: "A partir de hoje, todos os aparelhos devem passar pelo teste de consumo antes da abertura.",
    author: "Carlos Lima",
    date: "Hoje, 08:30",
    read: 10,
    total: 15,
    pinned: true,
  },
  {
    id: 2,
    type: "ESTOQUE",
    tone: "amber",
    title: "Chegada de novas peças",
    body: "Chegaram peças para os modelos OPPO Book 14 e RENO16. Retirada mediante registro da OS.",
    author: "Juliana Souza",
    date: "Ontem, 14:20",
    read: 15,
    total: 15,
  },
  {
    id: 3,
    type: "PROCEDIMENTO",
    tone: "blue",
    title: "Padrão de solda atualizado",
    body: "Utilize estanho 63x37 e fluxo apropriado. Registre fotos antes e depois do reparo em placa.",
    author: "Carlos Lima",
    date: "09/09, 10:15",
    read: 12,
    total: 15,
    pinned: true,
  },
  {
    id: 4,
    type: "TÉCNICO",
    tone: "violet",
    title: "Atualização de BIOS — UB363",
    body: "A nova versão já está disponível. Não atualize equipamentos fora da lista indicada.",
    author: "Marcos Tech",
    date: "08/09, 16:40",
    read: 7,
    total: 15,
  },
];

export default function Home() {
  const [view, setView] = useState<View>("board"),
    [channel, setChannel] = useState<Channel>("hardware"),
    [messages, setMessages] = useState(seed),
    [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("todos"),
    [read, setRead] = useState<number[]>([2]),
    [drawer, setDrawer] = useState(false),
    [help, setHelp] = useState(false),
    [newNotice, setNewNotice] = useState(false),
    [attachment, setAttachment] = useState<string | null>(null),
    [theme, setTheme] = useState<"dark" | "light">("dark");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const saved = localStorage.getItem("techchat-theme");
    if (saved === "light") setTheme("light");
  }, []);
  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("techchat-theme", next);
      return next;
    });
  }
  const shown = useMemo(
    () =>
      messages[channel].filter((m) =>
        (m.name + " " + m.text + " " + (m.details || []).join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [messages, channel, query],
  );
  function go(v: View) {
    setView(v);
    setDrawer(false);
    setQuery("");
  }
  function send() {
    if (!draft.trim() && !attachment) return;
    setMessages((p) => ({
      ...p,
      [channel]: [
        ...p[channel],
        {
          id: Date.now(),
          name: "Abraão Ulhoa",
          initials: "JS",
          time: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          role: "Técnico",
          text: draft.trim() || "Imagem do reparo",
          image: attachment || undefined,
        },
      ],
    }));
    setDraft("");
    setAttachment(null);
  }
  return (
    <main className="shell" data-theme={theme}>
      <aside className={"side " + (drawer ? "open" : "")}>
        <div className="brand">
          <i>
            <MessageSquare />
          </i>
          <strong>{appName}</strong>
          <button className="mobile" onClick={() => setDrawer(false)}>
            <X />
          </button>
        </div>
        <div className="profile">
          <span className="avatar blue">AU</span>
          <div>
            <b>Abraão Ulhoa</b>
            <small>
              <i />
              Online
            </small>
          </div>
          <ChevronDown />
        </div>
        <label className="navlabel">Canais técnicos</label>
        {(Object.keys(channels) as Channel[]).map((c) => (
          <button
            className={
              "nav " +
              (view === "board" && channel === c ? "active " : "") +
              (c === "urgentes" ? "danger" : "")
            }
            onClick={() => {
              setChannel(c);
              go("board");
            }}
            key={c}
          >
            <Hash />
            <span>{c === "duvidas" ? "dúvidas" : c}</span>
            {c === "urgentes" && <b>1</b>}
          </button>
        ))}
        <label className="navlabel separate">Informação</label>
        <button
          className={"nav " + (view === "notices" ? "active" : "")}
          onClick={() => go("notices")}
        >
          <Megaphone />
          <span>Comunicados</span>
          <b>{notices.length - read.length}</b>
        </button>
        <button
          className={"nav " + (view === "guide" ? "active" : "")}
          onClick={() => go("guide")}
        >
          <BookOpen />
          <span>Guia OPPO</span>
        </button>
        <div className="team">
          <label className="navlabel">
            Equipe online <b>4</b>
          </label>
          {[
            ["CL", "Carlos Lima"],
            ["MT", "Marcos Tech"],
            ["RC", "Rafael Costa"],
            ["JS", "Juliana Souza"],
          ].map((p, i) => (
            <div className="person" key={p[1]}>
              <span className={"avatar a" + i}>{p[0]}</span>
              <span>{p[1]}</span>
              <i />
            </div>
          ))}
        </div>
        <footer>
          <ShieldCheck /> Ambiente interno protegido
        </footer>
      </aside>
      {drawer && <button className="veil" onClick={() => setDrawer(false)} />}
      <section className="work">
        <header className="top">
          <button className="menu" onClick={() => setDrawer(true)}>
            <Menu />
          </button>
          <span className="section-icon">
            {view === "board" ? (
              <Hash />
            ) : view === "notices" ? (
              <Megaphone />
            ) : (
              <BookOpen />
            )}
          </span>
          <div className="heading">
            <h1>
              {view === "board"
                ? channel === "duvidas"
                  ? "Dúvidas"
                  : channel
                : view === "notices"
                  ? "Comunicados oficiais"
                  : "Guia de comentários OPPO"}
            </h1>
            <p>
              {view === "board"
                ? channels[channel]
                : view === "notices"
                  ? "Informações publicadas pela gestão e liderança"
                  : "Consulta rápida de falhas e textos padronizados"}
            </p>
          </div>
          {view !== "guide" && (
            <label className="search">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  view === "board"
                    ? "Pesquisar no canal"
                    : "Pesquisar comunicados"
                }
              />
              {query && (
                <button onClick={() => setQuery("")}>
                  <X />
                </button>
              )}
            </label>
          )}
          <button
            className="icon theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            aria-label={
              theme === "dark" ? "Usar tema claro" : "Usar tema escuro"
            }
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button className="icon bell">
            <Bell />
            <i />
          </button>
          <button className="help" onClick={() => setHelp(true)}>
            <CircleHelp />
            <span>Ajuda</span>
          </button>
        </header>
        {view === "board" && (
          <div className="board">
            <div className="messages">
              <div className="day">
                <span>Hoje</span>
              </div>
              {shown.length ? (
                shown.map((m) => (
                  <article className="message" key={m.id}>
                    <span
                      className={
                        "avatar " +
                        (m.initials === "MT"
                          ? "green"
                          : m.initials === "RC"
                            ? "amber"
                            : "blue")
                      }
                    >
                      {m.initials}
                    </span>
                    <div className="bubble">
                      <div className="meta">
                        <b>{m.name}</b>
                        <small>
                          {m.role} · {m.time}
                        </small>
                        {m.tag && <em className={m.tone}>{m.tag}</em>}
                        <button>
                          <MoreHorizontal />
                        </button>
                      </div>
                      <p>{m.text}</p>
                      {m.details && (
                        <div className="details">
                          {m.details.map((d) => (
                            <div key={d}>
                              <b>{d.split(":")[0]}:</b>
                              {d.split(":").slice(1).join(":")}
                            </div>
                          ))}
                        </div>
                      )}
                      {m.image && <img src={m.image} alt="Imagem do reparo" />}
                      {m.likes && (
                        <button className="like">👍 {m.likes}</button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <MessageSquare />
                  <h2>Nenhuma mensagem</h2>
                  <p>Inicie a conversa neste canal.</p>
                </div>
              )}
            </div>
            <div className="composer">
              {attachment && (
                <div className="attached">
                  <ImageIcon />
                  Imagem pronta para enviar{" "}
                  <button onClick={() => setAttachment(null)}>
                    <X />
                  </button>
                </div>
              )}
              <div>
                <button onClick={() => file.current?.click()}>
                  <Paperclip />
                </button>
                <input
                  ref={file}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachment(URL.createObjectURL(f));
                  }}
                />
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={"Mensagem em #" + channel}
                />
                <button
                  className="send"
                  disabled={!draft.trim() && !attachment}
                  onClick={send}
                >
                  <Send />
                </button>
              </div>
              <small>Enter para enviar · Shift + Enter para nova linha</small>
            </div>
            <aside className="about">
              <span>
                <Wrench />
              </span>
              <h2>Canal #{channel}</h2>
              <p>{channels[channel]}</p>
              <hr />
              <div>
                <Users /> <b>12</b> membros
              </div>
              <button onClick={() => setHelp(true)}>Como pedir ajuda</button>
            </aside>
          </div>
        )}
        {view === "notices" && (
          <div className="notices">
            <div className="noticebar">
              <div>
                {[
                  ["todos", "Todos"],
                  ["nao", "Não lidos"],
                  ["fixos", "Fixados"],
                ].map(([id, t]) => (
                  <button
                    key={id}
                    className={filter === id ? "on" : ""}
                    onClick={() => setFilter(id)}
                  >
                    {t}
                    {id === "nao" && (
                      <span>{notices.length - read.length}</span>
                    )}
                  </button>
                ))}
              </div>
              <button className="primary" onClick={() => setNewNotice(true)}>
                <Plus />
                Novo comunicado
              </button>
            </div>
            <div className="noticegrid">
              {notices
                .filter(
                  (n) =>
                    (filter === "todos" ||
                      (filter === "nao" && !read.includes(n.id)) ||
                      (filter === "fixos" && n.pinned)) &&
                    (n.title + n.body)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((n) => {
                  const done = read.includes(n.id);
                  const count = n.read + (done && n.id !== 2 ? 1 : 0);
                  return (
                    <article
                      className={"notice " + (done ? "read" : "")}
                      key={n.id}
                    >
                      <div>
                        <em className={n.tone}>{n.type}</em>
                        {n.pinned && <small>Fixado</small>}
                        <MoreHorizontal />
                      </div>
                      <h2>{n.title}</h2>
                      <p>{n.body}</p>
                      <footer>
                        <span>
                          {n.author} · {n.date}
                        </span>
                        <span>
                          {count} de {n.total} leram
                        </span>
                      </footer>
                      <i className="progress">
                        <b style={{ width: (count / n.total) * 100 + "%" }} />
                      </i>
                      <button
                        className={done ? "done" : ""}
                        onClick={() =>
                          setRead((x) => (x.includes(n.id) ? x : [...x, n.id]))
                        }
                      >
                        {done ? (
                          <>
                            <CheckCheck />
                            Leitura confirmada
                          </>
                        ) : (
                          <>
                            <Check />
                            Confirmar leitura
                          </>
                        )}
                      </button>
                    </article>
                  );
                })}
            </div>
          </div>
        )}
        {view === "guide" && (
          <div className="guide">
            <iframe
              key={theme}
              title="Guia de Comentários OPPO"
              src={"/guia/index.html?theme=" + theme}
            />
          </div>
        )}
      </section>
      {help && (
        <Modal close={() => setHelp(false)}>
          <span className="modalicon">
            <Wrench />
          </span>
          <h2>Como pedir ajuda técnica</h2>
          <p>Inclua as informações essenciais para evitar retrabalho.</p>
          <ol>
            <li>
              <b>Equipamento</b>
              <span>Modelo e ordem de serviço</span>
            </li>
            <li>
              <b>Falha encontrada</b>
              <span>Descreva o comportamento</span>
            </li>
            <li>
              <b>Testes realizados</b>
              <span>Liste medições e resultados</span>
            </li>
            <li>
              <b>Foto do reparo</b>
              <span>Anexe uma imagem nítida</span>
            </li>
          </ol>
          <button className="primary full" onClick={() => setHelp(false)}>
            Entendi
          </button>
        </Modal>
      )}
      {newNotice && (
        <Modal close={() => setNewNotice(false)}>
          <span className="modalicon">
            <Megaphone />
          </span>
          <h2>Novo comunicado</h2>
          <p>Publicação restrita à gestão e liderança.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setNewNotice(false);
            }}
          >
            <label>
              Categoria
              <select>
                <option>Procedimento</option>
                <option>Urgente</option>
                <option>Estoque</option>
                <option>Técnico</option>
              </select>
            </label>
            <label>
              Título
              <input required placeholder="Assunto principal" />
            </label>
            <label>
              Mensagem
              <textarea
                required
                rows={4}
                placeholder="Escreva a informação completa..."
              />
            </label>
            <button className="primary full">
              <Send />
              Publicar comunicado
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
function Modal({
  children,
  close,
}: {
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <div className="modalwrap">
      <button className="backdrop" onClick={close} />
      <section className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={close}>
          <X />
        </button>
        {children}
      </section>
    </div>
  );
}
