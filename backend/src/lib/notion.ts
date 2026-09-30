import { config } from "../config.js";
import { db, gravarValor, lerValor } from "../db.js";
import type { Tarefa } from "../types.js";

// Espelha as tarefas num banco do Notion (via API REST), pra consulta no celular e
// como "segundo cérebro" fora do app. O Órbita é a fonte da verdade; o Notion só recebe.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

const STATUS: Record<Tarefa["status"], string> = { inbox: "Caixa de entrada", todo: "A fazer", done: "Concluída" };
const QUADRANTE: Record<number, string> = { 1: "Q1 · Fazer agora", 2: "Q2 · Agendar", 3: "Q3 · Delegar", 4: "Q4 · Eliminar" };

export function notionConfigurado(): boolean {
  return Boolean(config.notionToken && config.notionParentPageId);
}

async function notion<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resp = await fetch(`${NOTION_API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${config.notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = (await resp.json().catch(() => ({}))) as { message?: string };
  if (!resp.ok) throw new Error(`Notion ${resp.status}: ${json.message ?? resp.statusText}`);
  return json as T;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function garantirBanco(): Promise<string> {
  const existente = lerValor("notion_database_id");
  if (existente) return existente;
  const opcoes = (valores: string[]) => ({ select: { options: valores.map((name) => ({ name })) } });
  const banco = await notion<{ id: string }>("POST", "/databases", {
    parent: { type: "page_id", page_id: config.notionParentPageId },
    title: [{ type: "text", text: { content: "Órbita — Tarefas" } }],
    properties: {
      Tarefa: { title: {} },
      Status: opcoes(Object.values(STATUS)),
      Quadrante: opcoes(Object.values(QUADRANTE)),
      Projeto: { select: {} },
      Contexto: { select: {} },
      Pomodoros: { number: {} },
      Prazo: { date: {} },
      "Planejada para": { date: {} },
    },
  });
  gravarValor("notion_database_id", banco.id);
  return banco.id;
}

function propriedades(t: Tarefa) {
  const data = (d: string | null) => ({ date: d ? { start: d } : null });
  // Notion não aceita vírgula em opção de select.
  const select = (v: string) => ({ select: v ? { name: v.replace(/,/g, " ") } : null });
  return {
    Tarefa: { title: [{ type: "text", text: { content: t.title } }] },
    Status: select(STATUS[t.status]),
    Quadrante: select(t.quadrant ? QUADRANTE[t.quadrant] : ""),
    Projeto: select(t.project),
    Contexto: select(t.context),
    Pomodoros: { number: t.estimate },
    Prazo: data(t.due_date),
    "Planejada para": data(t.planned_date),
  };
}

export interface ResultadoNotion {
  criadas: number;
  atualizadas: number;
  sincronizadoEm: string;
  url: string;
}

export async function sincronizarNotion(): Promise<ResultadoNotion> {
  if (!notionConfigurado()) throw new Error("NOTION_TOKEN e NOTION_PARENT_PAGE_ID não configurados.");
  const bancoId = await garantirBanco();

  // Tarefas abertas + concluídas nos últimos 30 dias.
  const tarefas = db
    .prepare(
      "SELECT * FROM tasks WHERE status != 'done' OR done_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')",
    )
    .all() as unknown as Tarefa[];
  const gravarId = db.prepare("UPDATE tasks SET notion_page_id = ? WHERE id = ?");

  let criadas = 0;
  let atualizadas = 0;
  for (const t of tarefas) {
    if (t.notion_page_id) {
      await notion("PATCH", `/pages/${t.notion_page_id}`, { properties: propriedades(t) });
      atualizadas++;
    } else {
      const pagina = await notion<{ id: string }>("POST", "/pages", {
        parent: { database_id: bancoId },
        properties: propriedades(t),
      });
      gravarId.run(pagina.id, t.id);
      criadas++;
    }
    await esperar(340); // limite médio da API do Notion: ~3 requisições/s
  }

  const sincronizadoEm = new Date().toISOString();
  gravarValor("notion_sync_at", sincronizadoEm);
  return { criadas, atualizadas, sincronizadoEm, url: `https://www.notion.so/${bancoId.replace(/-/g, "")}` };
}

/** Ao apagar uma tarefa no Órbita, arquiva a página correspondente (melhor esforço). */
export async function arquivarNoNotion(pageId: string): Promise<void> {
  if (!notionConfigurado()) return;
  await notion("PATCH", `/pages/${pageId}`, { archived: true }).catch((e) => console.error("[notion]", e));
}
