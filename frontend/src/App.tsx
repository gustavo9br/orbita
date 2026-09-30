import { useCallback, useEffect, useState } from "react";
import { api, quandoPerderSessao, type Settings } from "./lib/api";
import { mmss, usePomodoro } from "./lib/usePomodoro";
import { Ajustes } from "./pages/Ajustes";
import { Comunicacao } from "./pages/Comunicacao";
import { Hoje } from "./pages/Hoje";
import { Matriz } from "./pages/Matriz";
import { Painel } from "./pages/Painel";
import { Semana } from "./pages/Semana";
import { Carregando } from "./components/ui";

type Aba = "hoje" | "matriz" | "semana" | "comunicacao" | "painel" | "ajustes";

const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "hoje", nome: "Hoje", icone: "☀" },
  { id: "matriz", nome: "Caixa & Matriz", icone: "▦" },
  { id: "semana", nome: "Semana", icone: "🗓" },
  { id: "comunicacao", nome: "Comunicação", icone: "✉" },
  { id: "painel", nome: "Painel", icone: "📈" },
  { id: "ajustes", nome: "Ajustes", icone: "⚙" },
];

function abaInicial(): Aba {
  const hash = location.hash.slice(1) as Aba;
  return ABAS.some((a) => a.id === hash) ? hash : "hoje";
}

export default function App() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    quandoPerderSessao(() => setAutenticado(false));
    api
      .me()
      .then((r) => setAutenticado(r.autenticado))
      .catch(() => setAutenticado(false));
  }, []);

  if (autenticado === null)
    return (
      <div className="login">
        <Carregando />
      </div>
    );
  if (!autenticado) return <Login aoEntrar={() => setAutenticado(true)} />;
  return <Sistema aoSair={() => api.logout().then(() => setAutenticado(false))} />;
}

function Login({ aoEntrar }: { aoEntrar: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await api.login(senha);
      aoEntrar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="card pilha" onSubmit={entrar}>
        <div className="brand" style={{ padding: 0 }}>
          <Logo />
          <div>
            Órbita
            <small>sistema operacional pessoal</small>
          </div>
        </div>
        <label className="campo">
          Senha
          <input className="input" type="password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <div className="aviso erro">{erro}</div>}
        <button className="btn primario" disabled={!senha || enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="6" fill="var(--accent)" />
      <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" transform="rotate(-25 16 16)" />
      <circle cx="28" cy="10.5" r="2.2" fill="var(--q1)" />
    </svg>
  );
}

function Sistema({ aoSair }: { aoSair: () => void }) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [versao, setVersao] = useState(0);
  const [inbox, setInbox] = useState(0);

  const atualizar = useCallback(() => setVersao((v) => v + 1), []);
  const pomodoro = usePomodoro(settings, atualizar);

  useEffect(() => {
    api.settings().then((r) => setSettings(r.settings));
  }, []);

  useEffect(() => {
    api.tarefas("inbox").then((r) => setInbox(r.tarefas.length));
  }, [versao, aba]);

  useEffect(() => {
    location.hash = aba;
  }, [aba]);

  useEffect(() => {
    document.title = pomodoro.fase === "ocioso" ? "Órbita" : `${mmss(pomodoro.restanteMs)} · ${pomodoro.fase === "foco" ? "Foco" : "Pausa"} — Órbita`;
  }, [pomodoro.fase, pomodoro.restanteMs]);

  if (!settings)
    return (
      <div className="login">
        <Carregando />
      </div>
    );

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            Órbita
            <small>sistema operacional pessoal</small>
          </div>
        </div>
        {ABAS.map((a) => (
          <button key={a.id} className={`nav-btn ${aba === a.id ? "ativo" : ""}`} onClick={() => setAba(a.id)}>
            <span>
              {a.icone} {a.nome}
            </span>
            {a.id === "matriz" && inbox > 0 && <span className="nav-badge">{inbox}</span>}
          </button>
        ))}
        {pomodoro.fase !== "ocioso" && (
          <button className="sidebar-timer" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => setAba("hoje")}>
            {pomodoro.fase === "foco" ? "🍅 Em foco" : "☕ Pausa"}
            <strong>{mmss(pomodoro.restanteMs)}</strong>
          </button>
        )}
      </nav>
      <main className="main">
        {aba === "hoje" && <Hoje pomodoro={pomodoro} settings={settings} versao={versao} />}
        {aba === "matriz" && <Matriz aoMudar={atualizar} />}
        {aba === "semana" && <Semana settings={settings} aoMudar={atualizar} />}
        {aba === "comunicacao" && <Comunicacao />}
        {aba === "painel" && <Painel />}
        {aba === "ajustes" && <Ajustes settings={settings} aoSalvar={setSettings} aoSair={aoSair} />}
      </main>
    </div>
  );
}
