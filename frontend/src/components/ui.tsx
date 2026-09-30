import type { ReactNode } from "react";
import type { RespostaIA, Tarefa } from "../lib/api";
import { dataCurta, hojeLocal } from "../lib/format";

export const corQuadrante = (q: number | null) => (q ? `var(--q${q})` : "var(--border)");

export function ChipQuadrante({ q }: { q: number | null }) {
  if (!q) return null;
  return (
    <span className="chip q">
      <span className="dot" style={{ background: corQuadrante(q) }} />Q{q}
    </span>
  );
}

export function ItemTarefa({
  tarefa,
  aoConcluir,
  ativa,
  acoes,
  arrastavel,
}: {
  tarefa: Tarefa;
  aoConcluir?: (t: Tarefa) => void;
  ativa?: boolean;
  acoes?: ReactNode;
  arrastavel?: boolean;
}) {
  const feita = tarefa.status === "done";
  const atrasada = !feita && tarefa.due_date != null && tarefa.due_date < hojeLocal();
  return (
    <div
      className={`tarefa ${feita ? "feita" : ""} ${ativa ? "ativa" : ""}`}
      draggable={arrastavel}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(tarefa.id))}
    >
      {aoConcluir && (
        <button
          className={`check ${feita ? "on" : ""}`}
          aria-label={feita ? "Reabrir tarefa" : "Concluir tarefa"}
          onClick={() => aoConcluir(tarefa)}
        >
          {feita ? "✓" : ""}
        </button>
      )}
      <div className="tarefa-corpo">
        <div className="tarefa-titulo">{tarefa.title}</div>
        <div className="tarefa-meta">
          <ChipQuadrante q={tarefa.quadrant} />
          <span className="chip num">🍅 {tarefa.estimate}</span>
          {tarefa.project && <span className="chip">{tarefa.project}</span>}
          {tarefa.context && <span className="chip">{tarefa.context}</span>}
          {tarefa.due_date && (
            <span className="chip" style={atrasada ? { background: "var(--danger-bg)", color: "var(--danger)" } : undefined}>
              {atrasada ? "atrasada · " : "prazo "}
              {dataCurta(tarefa.due_date)}
            </span>
          )}
        </div>
      </div>
      {acoes}
    </div>
  );
}

/** Selo que deixa claro de onde veio o resultado: qual IA (e modelo) ou regras locais. */
export function OrigemIA({ resposta }: { resposta: RespostaIA<unknown> | null }) {
  if (!resposta) return null;
  return (
    <div className="pilha" style={{ gap: 6 }}>
      <span className="selo-ia">
        {resposta.modo === "heuristica"
          ? "⚙ Modo heurístico (sem IA)"
          : `✦ Gerado por IA · ${resposta.modo === "openai" ? "OpenAI" : "Claude"}${resposta.modelo ? ` (${resposta.modelo})` : ""}`}
      </span>
      {resposta.aviso && <div className="aviso">{resposta.aviso}</div>}
    </div>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  return (
    <span className="linha muted small">
      <span className="carregando" /> {texto ?? "Carregando…"}
    </span>
  );
}

/** Markdown mínimo (títulos ##, listas "- ", **negrito**) — suficiente pra revisão semanal. */
export function Markdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: string[] = [];
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  const fecharLista = () => {
    if (lista.length) {
      blocos.push(
        <ul key={blocos.length}>
          {lista.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (/^[-*] /.test(l)) {
      lista.push(l.slice(2));
      continue;
    }
    fecharLista();
    if (l.startsWith("#")) blocos.push(<h2 key={blocos.length}>{l.replace(/^#+\s*/, "")}</h2>);
    else if (l) blocos.push(<p key={blocos.length}>{inline(l)}</p>);
  }
  fecharLista();
  return <div className="markdown">{blocos}</div>;
}
