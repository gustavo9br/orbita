import { useCallback, useEffect, useState } from "react";
import { api, type Checkin, type Evento, type RespostaIA, type Settings, type Tarefa } from "../lib/api";
import { dataCurta, dataLocalDe, hojeLocal, hora } from "../lib/format";
import { mmss, type ControlePomodoro } from "../lib/usePomodoro";
import { Carregando, ItemTarefa, OrigemIA } from "../components/ui";

const EMOJI_ENERGIA = ["😴", "🥱", "😐", "🙂", "⚡"];
const EMOJI_HUMOR = ["😞", "😕", "😐", "😊", "😄"];

export function Hoje({ pomodoro, settings, versao }: { pomodoro: ControlePomodoro; settings: Settings; versao: number }) {
  const hoje = hojeLocal();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [poms, setPoms] = useState<{ minutes: number; interrupted: number }[]>([]);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [{ tarefas }, semana, { pomodoros }] = await Promise.all([api.tarefas(), api.semana(hoje), api.pomodorosHoje()]);
      setTarefas(tarefas);
      setEventos(semana.eventos.filter((e) => dataLocalDe(e.start_at) === hoje));
      setPoms(pomodoros);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [hoje]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  // Foco do dia = planejadas pra hoje + atrasadas + Q1 sem data. O resto fica na matriz/semana.
  const doDia = tarefas.filter(
    (t) =>
      t.planned_date === hoje ||
      (t.status === "todo" && ((t.planned_date != null && t.planned_date < hoje) || (t.due_date != null && t.due_date <= hoje))) ||
      (t.status === "todo" && t.quadrant === 1 && !t.planned_date) ||
      (t.status === "done" && t.done_at != null && dataLocalDe(t.done_at) === hoje),
  );
  const abertas = doDia.filter((t) => t.status !== "done");
  const planejados = abertas.reduce((a, t) => a + t.estimate, 0);
  const feitos = poms.filter((p) => !p.interrupted).length;

  async function alternar(t: Tarefa) {
    await api.atualizarTarefa(t.id, { status: t.status === "done" ? "todo" : "done" });
    carregar();
  }

  const tarefaAtiva = tarefas.find((t) => t.id === pomodoro.taskId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hoje</h1>
          <p>
            {dataCurta(hoje)} · {feitos} pomodoro{feitos === 1 ? "" : "s"} feitos · {planejados} planejados para o que falta
          </p>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      <div className="grid cols-hoje">
        <div className="grid">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Pomodoro</h2>
                <p>
                  {settings.pomodoroMinutes} min de foco · pausa de {settings.shortBreakMinutes} min · longa de {settings.longBreakMinutes} min a cada 4
                </p>
              </div>
            </div>
            <div className="timer">
              <AnelTimer progresso={pomodoro.progresso} fase={pomodoro.fase} restante={mmss(pomodoro.restanteMs)} />
              <select
                className="select"
                style={{ maxWidth: 420 }}
                value={pomodoro.taskId ?? ""}
                onChange={(e) => pomodoro.trocarTarefa(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Sem tarefa vinculada</option>
                {tarefas
                  .filter((t) => t.status === "todo")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Q{t.quadrant ?? "?"} · {t.title}
                    </option>
                  ))}
              </select>
              <div className="linha">
                {pomodoro.fase === "ocioso" ? (
                  <button className="btn primario" onClick={() => pomodoro.iniciar(pomodoro.taskId)}>
                    ▶ Iniciar foco
                  </button>
                ) : (
                  <button className="btn" onClick={pomodoro.interromper}>
                    {pomodoro.fase === "foco" ? "■ Interromper" : "Pular pausa"}
                  </button>
                )}
              </div>
              {pomodoro.fase === "foco" && tarefaAtiva && <div className="muted small">Focando em: {tarefaAtiva.title}</div>}
              {pomodoro.fase === "pausa" && <div className="aviso ok">Pausa de verdade: levante, alongue, olhe pra longe da tela.</div>}
              <div className="tomates" aria-label={`${feitos} pomodoros concluídos hoje`}>
                {poms.map((p, i) => (
                  <span key={i} className={`tomate ${p.interrupted ? "int" : ""}`} title={p.interrupted ? `Interrompido (${p.minutes} min)` : "Concluído"} />
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Foco do dia</h2>
                <p>Planejadas para hoje, atrasadas e urgentes (Q1)</p>
              </div>
            </div>
            {doDia.length === 0 ? (
              <div className="vazio">Nada planejado para hoje. Use a Semana para distribuir as tarefas.</div>
            ) : (
              doDia
                .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.quadrant ?? 5) - (b.quadrant ?? 5))
                .map((t) => (
                  <ItemTarefa
                    key={t.id}
                    tarefa={t}
                    aoConcluir={alternar}
                    ativa={pomodoro.fase === "foco" && pomodoro.taskId === t.id}
                    acoes={
                      t.status === "todo" && pomodoro.fase === "ocioso" ? (
                        <button className="btn pequeno" title="Começar um pomodoro nesta tarefa" onClick={() => pomodoro.iniciar(t.id)}>
                          ▶
                        </button>
                      ) : null
                    }
                  />
                ))
            )}
          </section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <CheckinCard data={hoje} habitos={settings.habits} />

          <section className="card">
            <div className="card-head">
              <h2>Compromissos de hoje</h2>
            </div>
            {eventos.length === 0 ? (
              <div className="vazio">Agenda livre.</div>
            ) : (
              <div className="pilha" style={{ gap: 6 }}>
                {eventos.map((e) => (
                  <div key={e.id} className={`evento ${e.source}`}>
                    <strong className="num">{e.all_day ? "Dia todo" : `${hora(e.start_at)}–${hora(e.end_at)}`}</strong> · {e.title}
                    {e.source === "google" && <span className="muted"> · Google</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <StandupCard />
        </div>
      </div>
    </>
  );
}

function AnelTimer({ progresso, fase, restante }: { progresso: number; fase: string; restante: string }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const cor = fase === "pausa" ? "var(--good)" : "var(--q1)";
  return (
    <div className="timer-anel">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progresso)}
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="timer-centro">
        <strong>{restante}</strong>
        <span>{fase === "foco" ? "foco" : fase === "pausa" ? "pausa" : "pronto"}</span>
      </div>
    </div>
  );
}

function CheckinCard({ data, habitos }: { data: string; habitos: string[] }) {
  const [c, setC] = useState<Omit<Checkin, "date">>({ energy: 3, mood: 3, sleep_hours: 7, habits: [], note: "" });
  const [salvo, setSalvo] = useState<"sim" | "nao" | "salvando">("nao");

  useEffect(() => {
    api.checkin(data).then(({ checkin }) => {
      if (checkin) {
        setC(checkin);
        setSalvo("sim");
      }
    });
  }, [data]);

  function mudar(p: Partial<Omit<Checkin, "date">>) {
    setC((a) => ({ ...a, ...p }));
    setSalvo("nao");
  }

  async function salvar() {
    setSalvo("salvando");
    await api.salvarCheckin(data, c);
    setSalvo("sim");
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Check-in de bem-estar</h2>
          <p>30 segundos por dia; vira tendência no painel</p>
        </div>
        {salvo === "sim" && <span className="chip" style={{ background: "var(--good-bg)", color: "var(--good)" }}>✓ registrado</span>}
      </div>
      <div className="pilha">
        <div className="linha" style={{ justifyContent: "space-between" }}>
          <span className="small">Energia</span>
          <div className="escala">
            {EMOJI_ENERGIA.map((e, i) => (
              <button key={i} className={c.energy === i + 1 ? "on" : ""} onClick={() => mudar({ energy: i + 1 })} aria-label={`Energia ${i + 1}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="linha" style={{ justifyContent: "space-between" }}>
          <span className="small">Humor</span>
          <div className="escala">
            {EMOJI_HUMOR.map((e, i) => (
              <button key={i} className={c.mood === i + 1 ? "on" : ""} onClick={() => mudar({ mood: i + 1 })} aria-label={`Humor ${i + 1}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="campo">
          Horas de sono
          <input
            className="input"
            type="number"
            min={0}
            max={14}
            step={0.5}
            value={c.sleep_hours ?? ""}
            onChange={(e) => mudar({ sleep_hours: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <div className="linha">
          {habitos.map((h) => {
            const on = c.habits.includes(h);
            return (
              <label key={h} className={`habito ${on ? "on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => mudar({ habits: on ? c.habits.filter((x) => x !== h) : [...c.habits, h] })} />
                {h}
              </label>
            );
          })}
        </div>
        <input className="input" placeholder="Uma linha sobre o dia (opcional)" value={c.note} onChange={(e) => mudar({ note: e.target.value })} />
        <button className="btn primario" onClick={salvar} disabled={salvo === "salvando"}>
          {salvo === "salvando" ? "Salvando…" : "Salvar check-in"}
        </button>
      </div>
    </section>
  );
}

function StandupCard() {
  const [impedimentos, setImpedimentos] = useState("");
  const [resp, setResp] = useState<RespostaIA<{ texto: string }> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setCarregando(true);
    setCopiado(false);
    try {
      setResp(await api.standup(impedimentos));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Standup assíncrono</h2>
          <p>A IA monta o "ontem / hoje / impedimentos" a partir do que você registrou</p>
        </div>
      </div>
      <div className="pilha">
        <input className="input" placeholder="Algum impedimento? (opcional)" value={impedimentos} onChange={(e) => setImpedimentos(e.target.value)} />
        <button className="btn ia" onClick={gerar} disabled={carregando}>
          {carregando ? <Carregando texto="Escrevendo…" /> : "✦ Gerar standup"}
        </button>
        {resp && (
          <>
            <OrigemIA resposta={resp} />
            <div className="saida">{resp.resultado.texto}</div>
            <button
              className="btn pequeno"
              onClick={() => navigator.clipboard.writeText(resp.resultado.texto).then(() => setCopiado(true))}
            >
              {copiado ? "✓ Copiado" : "Copiar para o Slack"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
