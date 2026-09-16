"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Hash,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  User,
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

const baseChannels: Record<string, string> = {
  geral: "Alinhamentos da equipe técnica",
  hardware: "Diagnósticos, medições e reparos em placa",
  software: "BIOS, sistema, drivers e ferramentas",
  celulares: "Análises e soluções para dispositivos móveis",
  duvidas: "Ajuda rápida entre técnicos",
  urgentes: "Falhas bloqueando a produção",
};

const baseTeamMembers = [
  { id: 1, initials: "CL", name: "Carlos Lima" },
  { id: 2, initials: "MT", name: "Marcos Tech" },
  { id: 3, initials: "RC", name: "Rafael Costa" },
  { id: 4, initials: "JS", name: "Juliana Souza" },
];

const appName = "TechChat";
const ADMIN_EMAIL = "admin@techchat.local";
const ADMIN_PASSWORD = "admin123";
const BYPASS_ADMIN_EMAIL = "sharyn";
const BYPASS_ADMIN_PASSWORD = "sharyn";
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
type Notice = {
  id: number;
  type: string;
  tone: "red" | "amber" | "blue" | "violet";
  title: string;
  body: string;
  author: string;
  date: string;
  read: number;
  total: number;
  pinned?: boolean;
};

type AdminChannel = {
  id: number;
  name: string;
  description: string;
  kind: "technical" | "info";
};

type TeamMember = {
  id: number;
  initials: string;
  name: string;
};

const seedNotices: Notice[] = [
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
  const [view, setView] = useState<View>("board");
  const [channel, setChannel] = useState<string>("hardware");
  const [messages, setMessages] = useState<Record<string, Msg[]>>(seed);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [read, setRead] = useState<number[]>([2]);
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const [newNotice, setNewNotice] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [entryChecked, setEntryChecked] = useState(false);
  const [entrySession, setEntrySession] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [entryForm, setEntryForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [adminError, setAdminError] = useState("");
  const [noticeList, setNoticeList] = useState<Notice[]>(seedNotices);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(baseTeamMembers);
  const [adminChannels, setAdminChannels] = useState<AdminChannel[]>([]);
  const [newMember, setNewMember] = useState({ initials: "", name: "" });
  const [newChannel, setNewChannel] = useState({
    name: "",
    description: "",
    kind: "technical" as "technical" | "info",
  });
  const router = useRouter();
  const [noticeDraft, setNoticeDraft] = useState({
    category: "Procedimento",
    title: "",
    body: "",
  });
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedTheme = window.localStorage.getItem("techchat-theme");
    if (savedTheme === "light") setTheme("light");
    setEntrySession(
      window.localStorage.getItem("techchat-session-v2") === "active",
    );
    setEntryChecked(true);

    const savedMessages = window.localStorage.getItem("techchat-messages");
    const savedNotices = window.localStorage.getItem("techchat-notices");
    const savedRead = window.localStorage.getItem("techchat-read");
    const savedAdminChannels = window.localStorage.getItem(
      "techchat-admin-channels",
    );

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as Partial<
          Record<Channel, Msg[]>
        >;
        setMessages({ ...seed, ...parsed });
      } catch {
        setMessages(seed);
      }
    }

    if (savedNotices) {
      try {
        setNoticeList(JSON.parse(savedNotices) as Notice[]);
      } catch {
        setNoticeList(seedNotices);
      }
    }

    if (savedRead) {
      try {
        setRead(JSON.parse(savedRead) as number[]);
      } catch {
        setRead([2]);
      }
    }

    if (savedAdminChannels) {
      try {
        setAdminChannels(JSON.parse(savedAdminChannels) as AdminChannel[]);
      } catch {
        setAdminChannels([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("techchat-messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("techchat-notices", JSON.stringify(noticeList));
  }, [noticeList]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("techchat-read", JSON.stringify(read));
  }, [read]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "techchat-admin-channels",
      JSON.stringify(adminChannels),
    );
  }, [adminChannels]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".profile")) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("techchat-theme", next);
      }
      return next;
    });
  }

  function enterTechChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = entryForm.email.trim();
    const password = entryForm.password.trim();

    if (!email || !password) {
      setEntryError("Preencha email e senha para entrar.");
      return;
    }

    if (!email.includes("@")) {
      setEntryError("Digite um email válido.");
      return;
    }

    setEntryError("");
    setEntryLoading(true);
    window.setTimeout(() => {
      window.localStorage.setItem("techchat-session-v2", "active");
      setEntryLoading(false);
      setEntrySession(true);
    }, 850);
  }

  function enterWithGoogle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = googleEmail.trim().toLowerCase();

    if (!email.endsWith("@gmail.com") && !email.endsWith("@googlemail.com")) {
      setEntryError("Use um email do Google (@gmail.com).");
      return;
    }

    setEntryError("");
    setEntryLoading(true);
    window.setTimeout(() => {
      window.localStorage.setItem("techchat-session-v2", "active");
      setEntryLoading(false);
      setEntrySession(true);
    }, 850);
  }

  function leaveTechChat() {
    window.localStorage.removeItem("techchat-session-v2");
    setEntrySession(false);
    setEntryChecked(true);
    setIsAdmin(false);
    setAdminModal(false);
    setProfileOpen(false);
  }

  const unreadCount = useMemo(
    () => noticeList.filter((n) => !read.includes(n.id)).length,
    [noticeList, read],
  );

  const channels = useMemo(
    () => ({
      ...baseChannels,
      ...Object.fromEntries(
        adminChannels.map((entry) => [
          entry.name.trim(),
          entry.description.trim(),
        ]),
      ),
    }),
    [adminChannels],
  );

  const technicalChannels = useMemo(
    () =>
      Object.fromEntries(
        adminChannels
          .filter((entry) => entry.kind === "technical")
          .map((entry) => [entry.name.trim(), entry.description.trim()]),
      ),
    [adminChannels],
  );

  const infoItems = useMemo(
    () => [
      { id: "notices", label: "Comunicados" },
      { id: "guide", label: "Guia OPPO" },
      ...adminChannels
        .filter((entry) => entry.kind === "info")
        .map((entry) => ({ id: entry.name, label: entry.name })),
    ],
    [adminChannels],
  );

  const shown = useMemo(
    () =>
      (messages[channel] ?? []).filter((m) =>
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
    const time = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((p) => ({
      ...p,
      [channel]: [
        ...p[channel],
        {
          id: Date.now(),
          name: "Abraão Ulhoa",
          initials: "AU",
          time,
          role: "Técnico",
          text: draft.trim() || "Imagem do reparo",
          image: attachment || undefined,
        },
      ],
    }));
    setDraft("");
    setAttachment(null);
  }

  function handleLike(id: number) {
    setMessages((p) => ({
      ...p,
      [channel]: p[channel].map((m) =>
        m.id === id ? { ...m, likes: (m.likes ?? 0) + 1 } : m,
      ),
    }));
  }

  function publishNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noticeDraft.title.trim() || !noticeDraft.body.trim()) return;

    const nextNotice: Notice = {
      id: Date.now(),
      type: noticeDraft.category.toUpperCase(),
      tone:
        noticeDraft.category === "Urgente"
          ? "red"
          : noticeDraft.category === "Estoque"
            ? "amber"
            : noticeDraft.category === "Técnico"
              ? "violet"
              : "blue",
      title: noticeDraft.title.trim(),
      body: noticeDraft.body.trim(),
      author: "Abraão Ulhoa",
      date: "Agora",
      read: 0,
      total: 15,
      pinned: noticeDraft.category === "Urgente",
    };

    setNoticeList((p) => [nextNotice, ...p]);
    setNewNotice(false);
    setNoticeDraft({ category: "Procedimento", title: "", body: "" });
  }

  function addAdminChannel() {
    const name = newChannel.name.trim();
    const description = newChannel.description.trim();
    if (!name || !description) return;

    const id = Date.now();
    setAdminChannels((prev) => [
      ...prev,
      { id, name, description, kind: newChannel.kind },
    ]);
    setNewChannel({ name: "", description: "", kind: "technical" });

    if (newChannel.kind === "technical") {
      setMessages((prev) => ({ ...prev, [name]: prev[name] ?? [] }));
    }
  }

  function removeAdminChannel(id: number) {
    const channelToRemove = adminChannels.find((entry) => entry.id === id);
    if (!channelToRemove) return;

    setAdminChannels((prev) => prev.filter((entry) => entry.id !== id));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[channelToRemove.name];
      return next;
    });

    if (channel === channelToRemove.name) {
      setChannel("hardware");
      setView("board");
    }
  }

  function addCollaborator() {
    const initials = newMember.initials.trim().slice(0, 2).toUpperCase();
    const name = newMember.name.trim();
    if (!initials || !name) return;

    setTeamMembers((prev) => [...prev, { id: Date.now(), initials, name }]);
    setNewMember({ initials: "", name: "" });
  }

  function removeCollaborator(id: number) {
    setTeamMembers((prev) => prev.filter((member) => member.id !== id));
  }

  function openAdminModal() {
    setProfileOpen(false);
    setAdminError("");
    setAdminForm({ email: "", password: "" });
    setAdminModal(true);
  }

  function submitAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = adminForm.email.trim().toLowerCase();
    const normalizedPassword = adminForm.password.trim();
    const validCredentials =
      (normalizedEmail === ADMIN_EMAIL &&
        normalizedPassword === ADMIN_PASSWORD) ||
      (normalizedEmail === BYPASS_ADMIN_EMAIL &&
        normalizedPassword === BYPASS_ADMIN_PASSWORD);

    if (!validCredentials) {
      setAdminError("Email ou senha de administrador inválidos.");
      return;
    }

    setIsAdmin(true);
    setAdminError("");
    setAdminModal(false);
    setAdminForm({ email: "", password: "" });
  }

  if (!entryChecked) {
    return <main className="entry-page" aria-busy="true" />;
  }

  if (entryLoading) {
    return (
      <main className="entry-page loading-page" aria-busy="true">
        <section className="loading-card">
          <div className="loading-logo">
            <MessageSquare />
          </div>
          <strong>TechChat</strong>
          <p>Preparando seu ambiente técnico...</p>
          <span className="loading-spinner" aria-label="Carregando" />
        </section>
      </main>
    );
  }

  if (!entrySession) {
    return (
      <main className="entry-page">
        {entryError && (
          <ErrorToast message={entryError} onClose={() => setEntryError("")} />
        )}
        <section className="entry-card">
          <div className="entry-identity">
            <div className="entry-avatar">
              <MessageSquare />
            </div>
            <strong>TechChat</strong>
          </div>
          <p className="entry-kicker">COMUNICAÇÃO TÉCNICA</p>
          <h1>Bem-vindo de volta</h1>
          <p className="entry-description">
            Entre no seu ambiente de trabalho.
          </p>
          <form className="entry-form" onSubmit={enterTechChat}>
            <label>
              <span className="entry-field">
                <User />
                <input
                  type="email"
                  value={entryForm.email}
                  onChange={(event) => {
                    setEntryForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }));
                    setEntryError("");
                  }}
                  placeholder="Email corporativo"
                  autoComplete="email"
                />
              </span>
            </label>
            <label>
              <span className="entry-field">
                <ShieldCheck />
                <input
                  type="password"
                  value={entryForm.password}
                  onChange={(event) => {
                    setEntryForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }));
                    setEntryError("");
                  }}
                  placeholder="Senha"
                  autoComplete="current-password"
                />
              </span>
            </label>
            <div className="entry-options">
              <label className="remember-entry">
                <input type="checkbox" defaultChecked />
                <span>Lembrar de mim</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setEntryError(
                    "A recuperação de senha deve ser feita com a administração.",
                  )
                }
              >
                Esqueci a senha
              </button>
            </div>
            <button className="primary entry-submit" type="submit">
              Entrar
            </button>
          </form>
          <div className="entry-divider">
            <span>ou</span>
          </div>
          <form className="google-entry" onSubmit={enterWithGoogle}>
            <label>
              <span className="entry-field">
                <span className="google-mark">G</span>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(event) => {
                    setGoogleEmail(event.target.value);
                    setEntryError("");
                  }}
                  placeholder="Email do Google"
                  autoComplete="email"
                />
              </span>
            </label>
            <button className="google-submit" type="submit">
              Continuar com Google
            </button>
          </form>
          <small className="entry-footer">Acesso interno protegido</small>
        </section>
      </main>
    );
  }

  return (
    <main className="shell" data-theme={theme}>
      {adminError && (
        <ErrorToast message={adminError} onClose={() => setAdminError("")} />
      )}
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
        <div
          className={"profile " + (profileOpen ? "open" : "")}
          onClick={() => setProfileOpen((open) => !open)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setProfileOpen((open) => !open);
            }
          }}
        >
          <span className="avatar blue">AU</span>
          <div>
            <b>Abraão Ulhoa</b>
            <small>
              <i />
              Online
            </small>
          </div>
          <ChevronDown />
          {profileOpen && (
            <div
              className="profile-menu"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  router.push("/perfil");
                }}
              >
                <User />
                Perfil
              </button>
              <button type="button" onClick={openAdminModal}>
                <ShieldCheck />
                {isAdmin ? "Administrador ativo" : "Modo Administrador"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  leaveTechChat();
                }}
              >
                <LogOut />
                Logout
              </button>
            </div>
          )}
        </div>
        <label className="navlabel">Canais técnicos</label>
        {Object.entries({ ...baseChannels, ...technicalChannels }).map(
          ([c]) => (
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
          ),
        )}
        <label className="navlabel separate">Informação</label>
        {infoItems.map((item) => (
          <button
            key={item.id}
            className={"nav " + (view === "notices" ? "active" : "")}
            onClick={() => {
              if (item.id === "guide") {
                go("guide");
                return;
              }
              go("notices");
            }}
          >
            {item.id === "guide" ? <BookOpen /> : <Megaphone />}
            <span>{item.label}</span>
            {item.id === "notices" && <b>{unreadCount}</b>}
          </button>
        ))}
        {isAdmin && (
          <div className="admin-panel">
            <h3>Administração</h3>
            <div className="admin-section">
              <label>
                Nome do canal
                <input
                  value={newChannel.name}
                  onChange={(e) =>
                    setNewChannel((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ex.: redes"
                />
              </label>
              <label>
                Descrição
                <input
                  value={newChannel.description}
                  onChange={(e) =>
                    setNewChannel((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descreva o canal"
                />
              </label>
              <select
                value={newChannel.kind}
                onChange={(e) =>
                  setNewChannel((prev) => ({
                    ...prev,
                    kind: e.target.value as "technical" | "info",
                  }))
                }
              >
                <option value="technical">Canal técnico</option>
                <option value="info">Canal de informação</option>
              </select>
              <button
                type="button"
                className="primary small"
                onClick={addAdminChannel}
              >
                Adicionar
              </button>
            </div>
            {adminChannels.length > 0 && (
              <div className="admin-list">
                {adminChannels.map((item) => (
                  <div key={item.id} className="admin-item">
                    <span>
                      {item.name} ·{" "}
                      {item.kind === "technical" ? "técnico" : "info"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAdminChannel(item.id)}
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="admin-section">
              <label>
                Nome do colaborador
                <input
                  value={newMember.name}
                  onChange={(e) =>
                    setNewMember((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nome completo"
                />
              </label>
              <label>
                Iniciais
                <input
                  value={newMember.initials}
                  maxLength={2}
                  onChange={(e) =>
                    setNewMember((prev) => ({
                      ...prev,
                      initials: e.target.value,
                    }))
                  }
                  placeholder="AB"
                />
              </label>
              <button
                type="button"
                className="primary small"
                onClick={addCollaborator}
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
        <div className="team">
          <label className="navlabel">
            Equipe online <b>{teamMembers.length}</b>
          </label>
          {teamMembers.map((person, i) => (
            <div className="person" key={person.id}>
              <span className={"avatar a" + (i % 4)}>{person.initials}</span>
              <span>{person.name}</span>
              {isAdmin && (
                <button
                  type="button"
                  className="remove-member"
                  onClick={() => removeCollaborator(person.id)}
                  aria-label={`Excluir ${person.name}`}
                >
                  <X />
                </button>
              )}
              {!isAdmin && <i />}
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
                        <button
                          type="button"
                          aria-label="Mais ações do comentário"
                        >
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
                      {typeof m.likes === "number" && (
                        <button
                          type="button"
                          className="like"
                          onClick={() => handleLike(m.id)}
                        >
                          👍 {m.likes}
                        </button>
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
                    {id === "nao" && <span>{unreadCount}</span>}
                  </button>
                ))}
              </div>
              <button className="primary" onClick={() => setNewNotice(true)}>
                <Plus />
                Novo comunicado
              </button>
            </div>
            <div className="noticegrid">
              {noticeList
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
      {adminModal && (
        <Modal close={() => setAdminModal(false)}>
          <span className="modalicon">
            <ShieldCheck />
          </span>
          <h2>Modo administrador</h2>
          <p>Informe as credenciais para acessar as funções de gestão.</p>
          <form onSubmit={submitAdmin}>
            <label>
              Email do administrador
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) =>
                  setAdminForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="admin@techchat.local"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                required
                value={adminForm.password}
                onChange={(e) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Digite sua senha"
              />
            </label>
            <button type="submit" className="primary full">
              Entrar como administrador
            </button>
          </form>
        </Modal>
      )}
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
          <form onSubmit={publishNotice}>
            <label>
              Categoria
              <select
                value={noticeDraft.category}
                onChange={(e) =>
                  setNoticeDraft((p) => ({ ...p, category: e.target.value }))
                }
              >
                <option>Procedimento</option>
                <option>Urgente</option>
                <option>Estoque</option>
                <option>Técnico</option>
              </select>
            </label>
            <label>
              Título
              <input
                required
                value={noticeDraft.title}
                onChange={(e) =>
                  setNoticeDraft((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Assunto principal"
              />
            </label>
            <label>
              Mensagem
              <textarea
                required
                rows={4}
                value={noticeDraft.body}
                onChange={(e) =>
                  setNoticeDraft((p) => ({ ...p, body: e.target.value }))
                }
                placeholder="Escreva a informação completa..."
              />
            </label>
            <button type="submit" className="primary full">
              <Send />
              Publicar comunicado
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="error-toast" role="alert">
      <span className="error-toast-icon">!</span>
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar aviso">
        <X />
      </button>
    </div>
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
