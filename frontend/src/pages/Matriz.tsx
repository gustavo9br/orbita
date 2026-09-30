import { useCallback, useEffect, useState } from "react";
import { api, type Quadrante, type RespostaIA, type SugestaoTriagem, type Tarefa } from "../lib/api";
import { QUADRANTES } from "../lib/format";
import { Carregando, corQuadrante, ItemTarefa, OrigemIA } from "../components/ui";

export function Matriz({ aoMudar }: { aoMudar: () => void }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [captura, setCaptura] = useState("");
  const [triagem, setTriagem] = useState<RespostaIA<SugestaoTriagem[]> | null>(null);
  const [triando, setTriando] = useState(false);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [projeto, setProjeto] = useState("");

  const carregar = useCallback(async () => {
    const { tarefas } = await api.tarefas();
    setTarefas(tarefas.filter((t) => t.status !== "done"));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const inbox = tarefas.filter((t) => t.status === "inbox");
  const projetos = [...new Set(tarefas.map((t) => t.project).filter(Boolean))].sort();
  const naMatriz = tarefas.filter((t) => t.status === "todo" && (!projeto || t.project === projeto));

  async function capturar() {
    if (!captura.trim()) return;
    await api.capturar(captura);
    setCaptura("");
    await carregar();
    aoMudar();
  }

  async function triar() {
    setTriando(true);
    setErro("");
    try {
      setTriagem(await api.triar());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setTriando(false);
    }
  }

  function editarSugestao(id: number, campos: Partial<SugestaoTriagem>) {
    setTriagem((t) => t && { ...t, resultado: t.resultado.map((s) => (s.id === id ? { ...s, ...campos } : s)) });
  }

  async function aplicar() {
    if (!triagem) return;
    await api.aplicarTriagem(triagem.resultado);
    setTriagem(null);
    await carregar();
    aoMudar();
  }

  async function mover(id: number, q: Quadrante) {
    setTarefas((ts) => ts.map((t) => (t.id === id ? { ...t, quadrant: q } : t)));
    await api.atualizarTarefa(id, { quadrant: q });
  }

  async function concluir(t: Tarefa) {
    await api.atualizarTarefa(t.id, { status: "done" });
    await carregar();
    aoMudar();
  }

  async function apagar(t: Tarefa) {
    await api.apagarTarefa(t.id);
    await carregar();
    aoMudar();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caixa de entrada & Matriz</h1>
          <p>Capture tudo sem pensar (GTD). Depois a IA processa e você decide onde cada coisa entra na matriz de Eisenhower.</p>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Captura rápida</h2>
              <p>Uma ideia por linha. Enter salva, Shift+Enter quebra linha.</p>
            </div>
          </div>
          <div className="pilha">
            <textarea
              className="textarea"
              placeholder={"cliente pediu relatório até sexta\nligar pro contador\nideia: automatizar fechamento de horas"}
              value={captura}
              onChange={(e) => setCaptura(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  capturar();
                }
              }}
            />
            <button className="btn primario" onClick={capturar} disabled={!captura.trim()}>
              Capturar
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>
                Caixa de entrada <span className="chip num">{inbox.length}</span>
              </h2>
              <p>Itens crus, ainda não processados</p>
            </div>
            <button className="btn ia" onClick={triar} disabled={!inbox.length || triando}>
              {triando ? <Carregando texto="Processando…" /> : "✦ Processar com IA"}
            </button>
          </div>
          {inbox.length === 0 ? (
            <div className="vazio">Caixa de entrada zerada. 🎉</div>
          ) : (
            <ul className="pilha" style={{ margin: 0, paddingLeft: 18, gap: 4 }}>
              {inbox.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {triagem && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h2>Revisar sugestões</h2>
              <p>A IA sugere; você confirma. Ajuste o que não fizer sentido antes de aplicar.</p>
            </div>
            <div className="linha">
              <button className="btn fantasma" onClick={() => setTriagem(null)}>
                Descartar
              </button>
              <button className="btn primario" onClick={aplicar}>
                Aplicar {triagem.resultado.length} itens
              </button>
            </div>
          </div>
          <OrigemIA resposta={triagem} />
          <div className="pilha" style={{ marginTop: 12 }}>
            {triagem.resultado.map((s) => {
              const original = inbox.find((t) => t.id === s.id);
              return (
                <div key={s.id} className="triagem-item" style={{ borderLeft: `4px solid ${corQuadrante(s.quadrante)}` }}>
                  <div>
                    <input
                      className="input"
                      style={{ fontWeight: 500, padding: "4px 8px" }}
                      value={s.titulo}
                      onChange={(e) => editarSugestao(s.id, { titulo: e.target.value })}
                    />
                    {original && original.title !== s.titulo && <div className="original">capturado como: “{original.title}”</div>}
                    <div className="small muted" style={{ marginTop: 4 }}>
                      💡 {s.justificativa}
                    </div>
                  </div>
                  <span />
                  <div className="triagem-controles">
                    <select className="select" value={s.quadrante} onChange={(e) => editarSugestao(s.id, { quadrante: Number(e.target.value) })}>
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q} value={q}>
                          {QUADRANTES[q].nome}
                        </option>
                      ))}
                    </select>
                    <select className="select" value={s.estimativa} onChange={(e) => editarSugestao(s.id, { estimativa: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          🍅 {n}
                        </option>
                      ))}
                    </select>
                    <input className="input" style={{ width: 150 }} value={s.projeto} onChange={(e) => editarSugestao(s.id, { projeto: e.target.value })} />
                    <input className="input" style={{ width: 130 }} value={s.contexto} onChange={(e) => editarSugestao(s.id, { contexto: e.target.value })} />
                    <input
                      className="input"
                      type="date"
                      value={s.prazo ?? ""}
                      onChange={(e) => editarSugestao(s.id, { prazo: e.target.value || null })}
                      title="Prazo"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="card-head">
        <div>
          <h2>Matriz de Eisenhower</h2>
          <p>Arraste as tarefas entre os quadrantes.</p>
        </div>
        <select className="select" style={{ width: "auto" }} value={projeto} onChange={(e) => setProjeto(e.target.value)}>
          <option value="">Todos os projetos</option>
          {projetos.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="matriz">
        {([1, 2, 3, 4] as Quadrante[]).map((q) => {
          const doQuadrante = naMatriz.filter((t) => t.quadrant === q || (q === 4 && t.quadrant == null));
          const pomodoros = doQuadrante.reduce((a, t) => a + t.estimate, 0);
          return (
            <div
              key={q}
              className={`quadrante ${alvo === q ? "alvo" : ""}`}
              style={{ ["--qc" as string]: corQuadrante(q) }}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(q);
              }}
              onDragLeave={() => setAlvo(null)}
              onDrop={(e) => {
                e.preventDefault();
                setAlvo(null);
                mover(Number(e.dataTransfer.getData("text/plain")), q);
              }}
            >
              <div className="quadrante-head">
                <div>
                  <h3>{QUADRANTES[q].nome}</h3>
                  <p>{QUADRANTES[q].dica}</p>
                </div>
                <span className="chip num">
                  {doQuadrante.length} · 🍅 {pomodoros}
                </span>
              </div>
              {doQuadrante.length === 0 ? (
                <div className="vazio">Solte tarefas aqui</div>
              ) : (
                doQuadrante.map((t) => (
                  <ItemTarefa
                    key={t.id}
                    tarefa={t}
                    arrastavel
                    aoConcluir={concluir}
                    acoes={
                      <span className="linha" style={{ gap: 2, flexWrap: "nowrap" }}>
                        {/* alternativa ao arrastar (toque no celular, teclado) */}
                        <select
                          className="select"
                          style={{ width: "auto", padding: "2px 4px", fontSize: "0.78rem" }}
                          aria-label="Mover para quadrante"
                          value={t.quadrant ?? 4}
                          onChange={(e) => mover(t.id, Number(e.target.value) as Quadrante)}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              Q{n}
                            </option>
                          ))}
                        </select>
                        <button className="btn pequeno fantasma perigo" title="Apagar" aria-label="Apagar tarefa" onClick={() => apagar(t)}>
                          ✕
                        </button>
                      </span>
                    }
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
