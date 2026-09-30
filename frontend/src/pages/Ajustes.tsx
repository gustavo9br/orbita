import { useEffect, useState } from "react";
import { api, type Integracoes, type Settings } from "../lib/api";
import { relativo } from "../lib/format";
import { Carregando } from "../components/ui";

export function Ajustes({ settings, aoSalvar, aoSair }: { settings: Settings; aoSalvar: (s: Settings) => void; aoSair: () => void }) {
  const [integ, setInteg] = useState<Integracoes | null>(null);
  const [form, setForm] = useState(settings);
  const [habitosTexto, setHabitosTexto] = useState(settings.habits.join("\n"));
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [sincronizando, setSincronizando] = useState<"google" | "notion" | null>(null);
  const [log, setLog] = useState<{ kind: string; mode: string; summary: string; created_at: string }[]>([]);

  useEffect(() => {
    api.integracoes().then(setInteg);
    api.statusIA().then((s) => setLog(s.log));
  }, []);

  async function sincronizar(qual: "google" | "notion") {
    setSincronizando(qual);
    setMsg(null);
    try {
      if (qual === "google") {
        const r = await api.syncGoogle();
        setMsg({ tipo: "ok", texto: `Google Agenda: ${r.importados} compromissos na janela, ${r.removidos} removidos.` });
      } else {
        const r = await api.syncNotion();
        setMsg({ tipo: "ok", texto: `Notion: ${r.criadas} páginas criadas, ${r.atualizadas} atualizadas.` });
      }
      setInteg(await api.integracoes());
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setSincronizando(null);
    }
  }

  async function salvar() {
    const { settings: novo } = await api.salvarSettings({
      ...form,
      habits: habitosTexto
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean),
    });
    aoSalvar(novo);
    setMsg({ tipo: "ok", texto: "Ajustes salvos." });
  }

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes & integrações</h1>
          <p>Ferramentas conectadas ao Órbita e parâmetros do seu sistema.</p>
        </div>
        <button className="btn" onClick={aoSair}>
          Sair
        </button>
      </div>
      {msg && (
        <div className={`aviso ${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
        </div>
      )}

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2>✦ Inteligência Artificial</h2>
          <p className="small muted">Triagem, planejamento semanal, mensagens, standup e revisão semanal.</p>
          {integ ? (
            <span className="chip" style={integ.ia.configurado ? { background: "var(--good-bg)", color: "var(--good)" } : undefined}>
              {integ.ia.configurado
                ? `● ${integ.ia.provedor === "openai" ? "OpenAI" : "Claude"} · ${integ.ia.modelo}`
                : "○ sem chave: modo heurístico"}
            </span>
          ) : (
            <Carregando />
          )}
        </section>
        <section className="card">
          <h2>📅 Google Agenda</h2>
          <p className="small muted">Compromissos entram no Hoje e na Semana e descontam capacidade no planejamento.</p>
          {integ && (
            <div className="pilha">
              <span className="chip">{integ.google.configurado ? `última sincronização ${relativo(integ.google.ultimaSync)}` : "○ GOOGLE_CALENDAR_ICS_URL não definida"}</span>
              <button className="btn" disabled={!integ.google.configurado || sincronizando !== null} onClick={() => sincronizar("google")}>
                {sincronizando === "google" ? <Carregando texto="Lendo agenda…" /> : "Sincronizar agora"}
              </button>
            </div>
          )}
        </section>
        <section className="card">
          <h2>🗂 Notion</h2>
          <p className="small muted">Tarefas espelhadas num banco do Notion, para consultar no celular.</p>
          {integ && (
            <div className="pilha">
              <span className="chip">{integ.notion.configurado ? `última sincronização ${relativo(integ.notion.ultimaSync)}` : "○ NOTION_TOKEN não definido"}</span>
              <div className="linha">
                <button className="btn" disabled={!integ.notion.configurado || sincronizando !== null} onClick={() => sincronizar("notion")}>
                  {sincronizando === "notion" ? <Carregando texto="Enviando…" /> : "Sincronizar agora"}
                </button>
                {integ.notion.url && (
                  <a className="btn fantasma" href={integ.notion.url} target="_blank" rel="noreferrer">
                    Abrir no Notion ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <h2>Parâmetros do sistema</h2>
          </div>
          <div className="pilha">
            <div className="grid cols-3" style={{ gap: 10 }}>
              <label className="campo">
                Foco (min)
                <input className="input" type="number" min={10} max={60} value={form.pomodoroMinutes} onChange={num("pomodoroMinutes")} />
              </label>
              <label className="campo">
                Pausa curta
                <input className="input" type="number" min={1} max={15} value={form.shortBreakMinutes} onChange={num("shortBreakMinutes")} />
              </label>
              <label className="campo">
                Pausa longa
                <input className="input" type="number" min={5} max={40} value={form.longBreakMinutes} onChange={num("longBreakMinutes")} />
              </label>
            </div>
            <div className="grid cols-3" style={{ gap: 10 }}>
              <label className="campo">
                Pomodoros/dia
                <input className="input" type="number" min={2} max={16} value={form.dailyCapacity} onChange={num("dailyCapacity")} />
              </label>
              <label className="campo">
                Início do expediente
                <input className="input" type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} />
              </label>
              <label className="campo">
                Fim do expediente
                <input className="input" type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} />
              </label>
            </div>
            <label className="campo">
              Hábitos acompanhados (um por linha)
              <textarea className="textarea" value={habitosTexto} onChange={(e) => setHabitosTexto(e.target.value)} />
            </label>
            <button className="btn primario" onClick={salvar}>
              Salvar ajustes
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Registro da IA</h2>
              <p>Transparência: cada vez que a IA foi usada, e em que modo</p>
            </div>
          </div>
          {log.length === 0 ? (
            <div className="vazio">Nenhum uso ainda.</div>
          ) : (
            <div className="pilha" style={{ gap: 6 }}>
              {log.map((l, i) => (
                <div key={i} className="linha small" style={{ justifyContent: "space-between" }}>
                  <span>
                    <span className="selo-ia">{l.mode === "heuristica" ? "⚙ heurística" : l.mode === "openai" ? "✦ OpenAI" : "✦ Claude"}</span> {l.kind.replace("_", " ")} · {l.summary}
                  </span>
                  <span className="muted">{relativo(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
