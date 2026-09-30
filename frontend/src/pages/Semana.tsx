import { useCallback, useEffect, useState } from "react";
import { api, type Evento, type Plano, type RespostaIA, type Semana as TSemana, type Settings, type Tarefa } from "../lib/api";
import { dataLocalDe, diaMes, diaSemana, hojeLocal, hora, somarDias } from "../lib/format";
import { Carregando, ChipQuadrante, corQuadrante, OrigemIA } from "../components/ui";

/** Horas de compromisso dentro do expediente (o mesmo critério do backend). */
function horasNoExpediente(dia: string, eventos: Evento[], s: Settings): number {
  const abre = new Date(`${dia}T${s.workStart}:00`).getTime();
  const fecha = new Date(`${dia}T${s.workEnd}:00`).getTime();
  return eventos.reduce((a, e) => {
    if (e.all_day) return a;
    const sob = Math.min(fecha, new Date(e.end_at).getTime()) - Math.max(abre, new Date(e.start_at).getTime());
    return a + Math.max(0, sob) / 3_600_000;
  }, 0);
}

export function Semana({ settings, aoMudar }: { settings: Settings; aoMudar: () => void }) {
  const [inicio, setInicio] = useState(hojeLocal());
  const [semana, setSemana] = useState<TSemana | null>(null);
  const [plano, setPlano] = useState<RespostaIA<Plano> | null>(null);
  const [planejando, setPlanejando] = useState(false);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [novoEvento, setNovoEvento] = useState({ title: "", dia: hojeLocal(), de: "14:00", ate: "15:00" });

  const carregar = useCallback(async () => {
    try {
      setSemana(await api.semana(inicio));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [inicio]);

  useEffect(() => {
    carregar();
    setPlano(null);
  }, [carregar]);

  if (!semana) return <Carregando />;

  const todas = [...semana.tarefas, ...semana.naoPlanejadas];
  const sugeridas = new Map((plano?.resultado.alocacoes ?? []).filter((a) => a.data).map((a) => [a.task_id, a]));

  async function planejar() {
    setPlanejando(true);
    setErro("");
    try {
      setPlano(await api.planejar(semana!.inicio));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPlanejando(false);
    }
  }

  async function aplicarPlano() {
    if (!plano) return;
    await api.aplicarPlano(plano.resultado.alocacoes);
    setPlano(null);
    await carregar();
    aoMudar();
  }

  async function planejarPara(id: number, dia: string | null) {
    await api.atualizarTarefa(id, { planned_date: dia });
    await carregar();
    aoMudar();
  }

  async function criarEvento() {
    if (!novoEvento.title.trim()) return;
    try {
      await api.criarEvento({
        title: novoEvento.title,
        start_at: new Date(`${novoEvento.dia}T${novoEvento.de}:00`).toISOString(),
        end_at: new Date(`${novoEvento.dia}T${novoEvento.ate}:00`).toISOString(),
      });
      setNovoEvento((n) => ({ ...n, title: "" }));
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Semana</h1>
          <p>
            {diaMes(semana.dias[0])} a {diaMes(semana.dias[6])} · capacidade de {semana.capacidade} pomodoros por dia útil, descontando reuniões
          </p>
        </div>
        <div className="linha">
          <button className="btn" onClick={() => setInicio(somarDias(semana.inicio, -7))} aria-label="Semana anterior">
            ←
          </button>
          <button className="btn" onClick={() => setInicio(hojeLocal())}>
            Esta semana
          </button>
          <button className="btn" onClick={() => setInicio(somarDias(semana.inicio, 7))} aria-label="Próxima semana">
            →
          </button>
          <button className="btn ia" onClick={planejar} disabled={planejando}>
            {planejando ? <Carregando texto="Planejando…" /> : "✦ Planejar semana com IA"}
          </button>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      {plano && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>Proposta de plano</h2>
              <p>As sugestões aparecem tracejadas nos dias. Nada muda até você aplicar.</p>
            </div>
            <div className="linha">
              <button className="btn fantasma" onClick={() => setPlano(null)}>
                Descartar
              </button>
              <button className="btn primario" onClick={aplicarPlano}>
                Aplicar plano
              </button>
            </div>
          </div>
          <div className="pilha">
            <OrigemIA resposta={plano} />
            <p style={{ margin: 0 }}>{plano.resultado.resumo}</p>
            {plano.resultado.blocos_foco.length > 0 && (
              <div className="linha">
                {plano.resultado.blocos_foco.map((b, i) => (
                  <span key={i} className="chip">
                    🎯 {diaSemana(b.data)} {b.periodo}: {b.tema}
                  </span>
                ))}
              </div>
            )}
            {plano.resultado.alertas.map((a, i) => (
              <div key={i} className="aviso">
                ⚠ {a}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="semana-scroll">
        <div className="semana">
          {semana.dias.map((dia) => {
            const eventos = semana.eventos.filter((e) => dataLocalDe(e.start_at) === dia);
            const doDia = todas.filter((t) => t.planned_date === dia && !sugeridas.has(t.id));
            const sugeridasDia = todas.filter((t) => sugeridas.get(t.id)?.data === dia);
            const reunioes = horasNoExpediente(dia, eventos, settings);
            const carga = doDia.filter((t) => t.status !== "done").reduce((a, t) => a + t.estimate, 0) + sugeridasDia.reduce((a, t) => a + t.estimate, 0);
            const disponivel = Math.max(0, Math.floor(semana.capacidade - reunioes * 2));
            const pct = disponivel ? Math.min(100, (carga / disponivel) * 100) : carga ? 100 : 0;
            return (
              <div
                key={dia}
                className={`dia ${dia === semana.hoje ? "hoje" : ""} ${dia < semana.hoje ? "passado" : ""}`}
                style={alvo === dia ? { background: "var(--accent-soft)" } : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  setAlvo(dia);
                }}
                onDragLeave={() => setAlvo(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setAlvo(null);
                  planejarPara(Number(e.dataTransfer.getData("text/plain")), dia);
                }}
              >
                <div className="dia-head">
                  <strong>{diaSemana(dia)}</strong>
                  <span className="muted small num">{diaMes(dia)}</span>
                </div>
                <div title={`${carga} de ${disponivel} pomodoros livres (${reunioes.toFixed(1)} h de reunião no expediente)`}>
                  <div className={`carga ${carga > disponivel ? "alta" : ""}`}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div className="small muted num" style={{ marginTop: 2 }}>
                    🍅 {carga}/{disponivel}
                    {carga > disponivel && <span style={{ color: "var(--danger)" }}> · sobrecarga</span>}
                  </div>
                </div>
                {eventos.map((e) => (
                  <div key={e.id} className={`evento ${e.source}`}>
                    <span className="num">{e.all_day ? "dia todo" : `${hora(e.start_at)}–${hora(e.end_at)}`}</span>
                    <br />
                    {e.title}
                    {e.source === "manual" && (
                      <button
                        className="btn pequeno fantasma"
                        style={{ padding: "0 4px", float: "right" }}
                        aria-label="Apagar compromisso"
                        onClick={() => api.apagarEvento(e.id).then(carregar)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {doDia.map((t) => (
                  <MiniTarefa key={t.id} t={t} aoTirar={() => planejarPara(t.id, null)} />
                ))}
                {sugeridasDia.map((t) => (
                  <MiniTarefa key={t.id} t={t} sugerida={sugeridas.get(t.id)?.motivo} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>
                Sem data <span className="chip num">{semana.naoPlanejadas.filter((t) => !sugeridas.has(t.id)).length}</span>
              </h2>
              <p>Arraste para um dia ou deixe a IA distribuir</p>
            </div>
          </div>
          {semana.naoPlanejadas.filter((t) => !sugeridas.has(t.id)).length === 0 ? (
            <div className="vazio">Tudo planejado.</div>
          ) : (
            <div className="pilha" style={{ gap: 6 }}>
              {semana.naoPlanejadas
                .filter((t) => !sugeridas.has(t.id))
                .map((t) => (
                  <MiniTarefa key={t.id} t={t} />
                ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Novo compromisso</h2>
              <p>Compromissos da Google Agenda entram sozinhos pela integração</p>
            </div>
          </div>
          <div className="pilha">
            <input
              className="input"
              placeholder="Ex.: Reunião com cliente"
              value={novoEvento.title}
              onChange={(e) => setNovoEvento({ ...novoEvento, title: e.target.value })}
            />
            <div className="linha">
              <input className="input" style={{ width: "auto" }} type="date" value={novoEvento.dia} onChange={(e) => setNovoEvento({ ...novoEvento, dia: e.target.value })} />
              <input className="input" style={{ width: "auto" }} type="time" value={novoEvento.de} onChange={(e) => setNovoEvento({ ...novoEvento, de: e.target.value })} />
              <span className="muted">até</span>
              <input className="input" style={{ width: "auto" }} type="time" value={novoEvento.ate} onChange={(e) => setNovoEvento({ ...novoEvento, ate: e.target.value })} />
            </div>
            <button className="btn primario" onClick={criarEvento} disabled={!novoEvento.title.trim()}>
              Adicionar compromisso
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function MiniTarefa({ t, sugerida, aoTirar }: { t: Tarefa; sugerida?: string; aoTirar?: () => void }) {
  return (
    <div
      className={`mini-tarefa ${t.status === "done" ? "feita" : ""} ${sugerida ? "sugerida" : ""}`}
      style={{ ["--qc" as string]: corQuadrante(t.quadrant) }}
      draggable={!sugerida}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
      title={sugerida ? `Sugestão da IA: ${sugerida}` : t.title}
    >
      <span style={{ overflowWrap: "anywhere" }}>
        {sugerida && "✦ "}
        {t.title}
      </span>
      <span className="mini-tarefa-meta">
        <ChipQuadrante q={t.quadrant} />
        <span className="num muted">🍅 {t.estimate}</span>
        {t.project && <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.project}</span>}
        <span style={{ flex: 1 }} />
        {aoTirar && t.status !== "done" && (
          <button className="btn pequeno fantasma" style={{ padding: "0 3px" }} onClick={aoTirar} aria-label="Tirar do dia" title="Tirar do dia">
            ✕
          </button>
        )}
      </span>
    </div>
  );
}
