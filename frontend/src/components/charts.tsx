import { useState } from "react";

// Gráficos em SVG puro, seguindo as specs: barras <= 24px com ponta arredondada de 4px
// e base reta, linhas de 2px, grade de 1px recessiva, um único eixo, tooltip no hover.

const ALTURA = 200;
const MARGEM = { topo: 18, dir: 12, base: 28, esq: 30 };

function ticksLimpos(max: number): number[] {
  if (max <= 0) return [0, 1];
  const passo = [1, 2, 5, 10, 20, 50, 100].find((p) => max / p <= 5) ?? Math.ceil(max / 5);
  const topo = Math.ceil(max / passo) * passo;
  return Array.from({ length: topo / passo + 1 }, (_, i) => i * passo);
}

/** Caminho de uma coluna com o topo arredondado (4px) e a base reta. */
function colunaPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

interface Tip {
  x: number;
  y: number;
  texto: string;
}

export function GraficoColunas({
  dados,
  formatarValor,
  destacarUltimo,
}: {
  dados: { rotulo: string; valor: number; dica: string }[];
  formatarValor?: (v: number) => string;
  destacarUltimo?: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const largura = 640;
  const ticks = ticksLimpos(Math.max(...dados.map((d) => d.valor), 0));
  const max = ticks[ticks.length - 1];
  const areaW = largura - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const banda = areaW / dados.length;
  const barW = Math.min(24, banda * 0.62);
  const y = (v: number) => MARGEM.topo + areaH - (v / max) * areaH;
  const maiorIdx = dados.reduce((m, d, i) => (d.valor > dados[m].valor ? i : m), 0);

  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} role="img" aria-label="Gráfico de colunas">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text className="eixo" x={MARGEM.esq - 6} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const cx = MARGEM.esq + banda * i + banda / 2;
          const h = Math.max(0, y(0) - y(d.valor));
          const ultimo = i === dados.length - 1;
          return (
            <g key={i}>
              {d.valor > 0 && (
                <path
                  d={colunaPath(cx - barW / 2, y(d.valor), barW, h)}
                  fill={destacarUltimo && !ultimo ? "var(--seq-soft)" : "var(--series-1)"}
                />
              )}
              {(i === maiorIdx || (destacarUltimo && ultimo)) && d.valor > 0 && (
                <text className="rotulo-dado" x={cx} y={y(d.valor) - 5} textAnchor="middle">
                  {formatarValor ? formatarValor(d.valor) : d.valor}
                </text>
              )}
              <text className="eixo" x={cx} y={ALTURA - 8} textAnchor="middle">
                {d.rotulo}
              </text>
              {/* alvo de hover maior que a barra */}
              <rect
                x={cx - banda / 2}
                y={MARGEM.topo}
                width={banda}
                height={areaH}
                fill="transparent"
                onMouseEnter={() => setTip({ x: (cx / largura) * 100, y: (y(d.valor) / ALTURA) * 100, texto: d.dica })}
              />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
          {tip.texto}
        </div>
      )}
    </div>
  );
}

export function GraficoLinhas({
  rotulos,
  series,
  min,
  max,
}: {
  rotulos: string[];
  series: { nome: string; cor: string; valores: (number | null)[] }[];
  min: number;
  max: number;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const largura = 640;
  const areaW = largura - MARGEM.esq - MARGEM.dir - 60; // espaço à direita pros rótulos finais
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (i: number) => MARGEM.esq + (rotulos.length > 1 ? (i / (rotulos.length - 1)) * areaW : areaW / 2);
  const y = (v: number) => MARGEM.topo + areaH - ((v - min) / (max - min)) * areaH;
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Rótulos no fim da linha só se não colidirem; senão legenda + tooltip carregam a identidade.
  const finais = series.map((s) => {
    const i = s.valores.reduce<number>((u, v, j) => (v != null ? j : u), -1);
    return i >= 0 ? y(s.valores[i]!) : null;
  });
  const rotularFinais = finais.every((a, i) => a == null || finais.every((b, j) => j === i || b == null || Math.abs(a - b) >= 14));

  // Pontos sem check-in quebram a linha (não interpolamos dado inexistente).
  const caminho = (valores: (number | null)[]) => {
    let d = "";
    let aberto = false;
    valores.forEach((v, i) => {
      if (v == null) {
        aberto = false;
        return;
      }
      d += `${aberto ? "L" : "M"}${x(i)},${y(v)} `;
      aberto = true;
    });
    return d;
  };

  return (
    <div className="chart" onMouseLeave={() => setIdx(null)}>
      <div className="legenda">
        {series.map((s) => (
          <span key={s.nome}>
            <i style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} role="img" aria-label={`Gráfico de linhas: ${series.map((s) => s.nome).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGEM.esq} x2={MARGEM.esq + areaW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text className="eixo" x={MARGEM.esq - 6} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) =>
          i % Math.ceil(rotulos.length / 7) === 0 || i === rotulos.length - 1 ? (
            <text key={i} className="eixo" x={x(i)} y={ALTURA - 8} textAnchor="middle">
              {r}
            </text>
          ) : null,
        )}
        {idx != null && <line x1={x(idx)} x2={x(idx)} y1={MARGEM.topo} y2={MARGEM.topo + areaH} stroke="var(--ink-3)" strokeWidth={1} />}
        {series.map((s) => {
          const ultimoIdx = s.valores.reduce<number>((u, v, i) => (v != null ? i : u), -1);
          return (
            <g key={s.nome}>
              <path d={caminho(s.valores)} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.valores.map((v, i) =>
                v != null && (i === idx || i === ultimoIdx) ? (
                  <circle key={i} cx={x(i)} cy={y(v)} r={4.5} fill={s.cor} stroke="var(--surface)" strokeWidth={2} />
                ) : null,
              )}
              {ultimoIdx >= 0 && rotularFinais && (
                <text className="rotulo-dado" x={x(ultimoIdx) + 10} y={y(s.valores[ultimoIdx]!) + 4}>
                  {s.nome} {s.valores[ultimoIdx]}
                </text>
              )}
            </g>
          );
        })}
        {rotulos.map((_, i) => (
          <rect
            key={i}
            x={x(i) - areaW / rotulos.length / 2}
            y={MARGEM.topo}
            width={areaW / rotulos.length}
            height={areaH}
            fill="transparent"
            onMouseEnter={() => setIdx(i)}
          />
        ))}
      </svg>
      {idx != null && (
        <div className="tooltip" style={{ left: `${(x(idx) / largura) * 100}%`, top: `${(MARGEM.topo / ALTURA) * 100}%` }}>
          {rotulos[idx]} · {series.map((s) => `${s.nome}: ${s.valores[idx] ?? "—"}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

/** Barras horizontais de um único tom, com rótulo e valor em texto (nunca cor-apenas). */
export function ListaBarras({
  itens,
  formatar,
  maximo,
}: {
  itens: { rotulo: string; valor: number; cor?: string; dica?: string }[];
  formatar: (v: number) => string;
  maximo?: number;
}) {
  const max = maximo ?? Math.max(...itens.map((i) => i.valor), 1);
  if (!itens.length) return <div className="vazio">Sem dados no período.</div>;
  return (
    <div>
      {itens.map((i) => (
        <div className="barra-linha" key={i.rotulo} title={i.dica}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.rotulo}</span>
          <div className="barra-trilho">
            <div style={{ width: `${(i.valor / max) * 100}%`, background: i.cor ?? "var(--series-1)" }} />
          </div>
          <span className="v">{formatar(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}
