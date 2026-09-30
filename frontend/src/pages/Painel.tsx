import { useEffect, useState } from "react";
import { api, type Painel as TPainel, type RespostaIA } from "../lib/api";
import { diaMes, diaSemana, numero, relativo } from "../lib/format";
import { GraficoColunas, GraficoLinhas, ListaBarras } from "../components/charts";
import { Carregando, Markdown, OrigemIA } from "../components/ui";

const NOMES_IA: Record<string, string> = {
  triagem: "Triagem da caixa de entrada",
  plano_semanal: "Planejamento semanal",
  comunicacao: "Mensagens redigidas",
  standup: "Standups",
  revisao_semanal: "Revisões semanais",
};

function Delta({ atual, anterior, maiorEhMelhor = true, sufixo = "" }: { atual: number; anterior: number; maiorEhMelhor?: boolean; sufixo?: string }) {
  if (!anterior) return <span className="delta muted">sem semana anterior</span>;
  const dif = atual - anterior;
  const bom = maiorEhMelhor ? dif >= 0 : dif <= 0;
  return (
    <span className={`delta ${dif === 0 ? "" : bom ? "bom" : "ruim"}`}>
      {dif > 0 ? "▲" : dif < 0 ? "▼" : "="} {numero(Math.abs(dif), sufixo === "h" ? 1 : 0)}
      {sufixo} vs mesmo ponto da semana passada
    </span>
  );
}

export function Painel() {
  const [dias, setDias] = useState(14);
  const [p, setP] = useState<TPainel | null>(null);
  const [revisao, setRevisao] = useState<RespostaIA<{ markdown: string }> | null>(null);
  const [ultimaRevisao, setUltimaRevisao] = useState<{ content: string; created_at: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    api.painel(dias).then(setP);
  }, [dias]);

  useEffect(() => {
    api.revisoes().then(({ revisoes }) => setUltimaRevisao(revisoes[0] ?? null));
  }, []);

  async function gerarRevisao() {
    setGerando(true);
    try {
      setRevisao(await api.revisao());
    } finally {
      setGerando(false);
    }
  }

  if (!p) return <Carregando />;

  const { semanaAtual: sa, semanaAnterior: sp } = p;
  const totalFoco = Object.values(p.minutosPorQuadrante).reduce((a, b) => a + b, 0);
  const pctQ2 = totalFoco ? (p.minutosPorQuadrante.Q2 ?? 0) / totalFoco : 0;
  const rotulos = p.serie.map((d) => diaMes(d.data));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Painel</h1>
          <p>
            Últimos {p.periodo.dias} dias ({diaMes(p.periodo.inicio)} a {diaMes(p.periodo.fim)}) · o que medir é o que melhora
          </p>
        </div>
        <select className="select" style={{ width: "auto" }} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
          <option value={30}>30 dias</option>
        </select>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="small muted">Horas de foco nesta semana</div>
          <div className="hero">{numero(sa.horasFoco, 1)} h</div>
          <Delta atual={sa.horasFoco} anterior={sp.horasFoco} sufixo="h" />
          <div style={{ marginTop: 18 }}>
            <ListaBarras
              formatar={(h) => `${numero(h, 1)} h`}
              itens={[
                { rotulo: "Esta semana", valor: sa.horasFoco },
                { rotulo: "Semana passada", valor: sp.horasFoco, cor: "var(--seq-soft)", dica: "Até o mesmo dia da semana" },
              ]}
            />
          </div>
        </section>
        <div className="stats" style={{ gridColumn: "span 2", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div className="stat">
            <div className="rotulo">Pomodoros na semana</div>
            <div className="valor">{sa.pomodoros}</div>
            <Delta atual={sa.pomodoros} anterior={sp.pomodoros} />
          </div>
          <div className="stat">
            <div className="rotulo">Tarefas concluídas</div>
            <div className="valor">{sa.concluidas}</div>
            <Delta atual={sa.concluidas} anterior={sp.concluidas} />
          </div>
          <div className="stat">
            <div className="rotulo">Interrupções</div>
            <div className="valor">{numero(sa.taxaInterrupcao * 100)}%</div>
            <span className="delta muted">mesmo período anterior: {numero(sp.taxaInterrupcao * 100)}%</span>
          </div>
          <div className="stat">
            <div className="rotulo">Plano cumprido</div>
            <div className="valor">
              {p.aderenciaPlano.concluidas}/{p.aderenciaPlano.planejadas}
            </div>
            <span className="delta muted">tarefas planejadas nesta semana</span>
          </div>
          <div className="stat">
            <div className="rotulo">Check-in seguido</div>
            <div className="valor">{p.sequenciaCheckin} dias</div>
          </div>
          <div className="stat">
            <div className="rotulo">Foco fora do horário</div>
            <div className="valor" style={{ color: p.pomodorosForaDoHorario ? "var(--warn)" : undefined }}>
              {p.pomodorosForaDoHorario}
            </div>
            <span className="delta muted">pomodoros no período</span>
          </div>
        </div>
      </div>

      {(p.caixaDeEntrada > 0 || p.atrasadas > 0) && (
        <div className="linha" style={{ marginBottom: 16 }}>
          {p.caixaDeEntrada > 0 && <div className="aviso">📥 {p.caixaDeEntrada} item(ns) na caixa de entrada esperando triagem</div>}
          {p.atrasadas > 0 && <div className="aviso erro">⏰ {p.atrasadas} tarefa(s) com prazo vencido</div>}
        </div>
      )}

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Pomodoros concluídos por dia</h2>
              <p>Blocos de 25 min sem interrupção</p>
            </div>
          </div>
          <GraficoColunas
            destacarUltimo
            dados={p.serie.map((d) => ({
              rotulo: dias > 14 ? diaMes(d.data).slice(0, 2) : diaSemana(d.data).slice(0, 3),
              valor: d.pomodoros,
              dica: `${diaSemana(d.data)} ${diaMes(d.data)}: ${d.pomodoros} pomodoros · ${numero(d.minutosFoco / 60, 1)} h · ${d.concluidas} concluídas`,
            }))}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Energia e humor</h2>
              <p>Check-in diário, escala de 1 a 5 (dias sem check-in ficam em branco)</p>
            </div>
          </div>
          <GraficoLinhas
            rotulos={rotulos}
            min={1}
            max={5}
            series={[
              { nome: "Energia", cor: "var(--series-1)", valores: p.serie.map((d) => d.energia) },
              { nome: "Humor", cor: "var(--series-2)", valores: p.serie.map((d) => d.humor) },
            ]}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Para onde foi o foco</h2>
              <p>Tempo de foco por quadrante de Eisenhower</p>
            </div>
            <span className="chip" style={pctQ2 >= 0.5 ? { background: "var(--good-bg)", color: "var(--good)" } : undefined}>
              {numero(pctQ2 * 100)}% em Q2 {pctQ2 >= 0.5 ? "✓" : "· meta 50%"}
            </span>
          </div>
          <ListaBarras
            formatar={(m) => `${numero(m / 60, 1)} h`}
            itens={["Q1", "Q2", "Q3", "Q4", "Sem tarefa"].map((q) => ({
              rotulo: { Q1: "Q1 · Fazer agora", Q2: "Q2 · Agendar", Q3: "Q3 · Delegar", Q4: "Q4 · Eliminar", "Sem tarefa": "Sem tarefa" }[q]!,
              valor: p.minutosPorQuadrante[q] ?? 0,
              cor: q === "Sem tarefa" ? "var(--q4)" : `var(--q${q[1]})`,
            }))}
          />
          <p className="small muted" style={{ marginBottom: 0 }}>
            Q2 é onde mora o trabalho que evita incêndios futuros. Muito Q1 sinaliza que o planejamento está atrasado.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Foco por projeto</h2>
              <p>Horas de pomodoros concluídos</p>
            </div>
          </div>
          <ListaBarras
            formatar={(m) => `${numero(m / 60, 1)} h`}
            itens={Object.entries(p.minutosPorProjeto)
              .sort((a, b) => b[1] - a[1])
              .map(([rotulo, valor]) => ({ rotulo, valor }))}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Hábitos de bem-estar</h2>
              <p>% dos dias com check-in em que o hábito foi cumprido</p>
            </div>
          </div>
          <ListaBarras maximo={1} formatar={(v) => `${numero(v * 100)}%`} itens={p.habitos.map((h) => ({ rotulo: h.habito, valor: h.taxa, cor: "var(--good)" }))} />
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>A IA no dia a dia</h2>
              <p>Quantas vezes a IA apoiou a organização no período</p>
            </div>
          </div>
          <ListaBarras
            formatar={(v) => String(v)}
            itens={Object.entries(
              p.usoIA.reduce<Record<string, number>>((a, u) => ({ ...a, [u.kind]: (a[u.kind] ?? 0) + u.n }), {}),
            )
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ rotulo: NOMES_IA[k] ?? k, valor: v, cor: "#4a3aa7" }))}
          />
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <h2>Revisão semanal</h2>
            <p>A IA lê os números da semana (foco, tarefas, energia, hábitos) e propõe 3 ajustes concretos</p>
          </div>
          <button className="btn ia" onClick={gerarRevisao} disabled={gerando}>
            {gerando ? <Carregando texto="Revisando a semana…" /> : "✦ Gerar revisão da semana"}
          </button>
        </div>
        {revisao ? (
          <div className="pilha">
            <OrigemIA resposta={revisao} />
            <Markdown texto={revisao.resultado.markdown} />
          </div>
        ) : ultimaRevisao ? (
          <div className="pilha">
            <span className="small muted">Última revisão gerada {relativo(ultimaRevisao.created_at)}</span>
            <Markdown texto={ultimaRevisao.content} />
          </div>
        ) : (
          <div className="vazio">Nenhuma revisão ainda. Sexta à tarde é um bom momento.</div>
        )}
      </section>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>Ver dados diários em tabela</summary>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="small num" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-2)" }}>
                {["Dia", "Pomodoros", "Horas de foco", "Concluídas", "Energia", "Humor", "Sono (h)", "Hábitos"].map((h) => (
                  <th key={h} style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.serie.map((d) => (
                <tr key={d.data}>
                  {[
                    `${diaSemana(d.data)} ${diaMes(d.data)}`,
                    d.pomodoros,
                    numero(d.minutosFoco / 60, 1),
                    d.concluidas,
                    d.energia ?? "—",
                    d.humor ?? "—",
                    d.sono ?? "—",
                    d.habitos ?? "—",
                  ].map((v, i) => (
                    <td key={i} style={{ padding: "4px 8px", borderBottom: "1px solid var(--grid)" }}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
