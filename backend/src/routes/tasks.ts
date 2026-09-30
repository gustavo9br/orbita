import { Router } from "express";
import { db } from "../db.js";
import { arquivarNoNotion } from "../lib/notion.js";
import type { Tarefa } from "../types.js";

export const tasksRouter = Router();

const CAMPOS_EDITAVEIS = [
  "title",
  "notes",
  "status",
  "quadrant",
  "estimate",
  "context",
  "project",
  "due_date",
  "planned_date",
] as const;

export function buscarTarefa(id: number): Tarefa | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as unknown as Tarefa | undefined;
}

tasksRouter.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const sql = status
    ? "SELECT * FROM tasks WHERE status = ? ORDER BY COALESCE(quadrant, 5), COALESCE(due_date, '9999'), id"
    : "SELECT * FROM tasks WHERE status != 'done' OR done_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days') ORDER BY COALESCE(quadrant, 5), COALESCE(due_date, '9999'), id";
  const tarefas = (status ? db.prepare(sql).all(status) : db.prepare(sql).all()) as unknown as Tarefa[];
  res.json({ tarefas });
});

/** Captura rápida (GTD): tudo entra na caixa de entrada; aceita várias linhas de uma vez. */
tasksRouter.post("/", (req, res) => {
  const texto = String(req.body?.title ?? "").trim();
  if (!texto) return void res.status(400).json({ erro: "Escreva alguma coisa pra capturar." });
  const inserir = db.prepare("INSERT INTO tasks (title, notes) VALUES (?, ?)");
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  const ids = linhas.map((linha) => Number(inserir.run(linha, String(req.body?.notes ?? "")).lastInsertRowid));
  res.status(201).json({ tarefas: ids.map(buscarTarefa) });
});

tasksRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = buscarTarefa(id);
  if (!atual) return void res.status(404).json({ erro: "Tarefa não encontrada." });

  const sets: string[] = [];
  const valores: (string | number | null)[] = [];
  for (const campo of CAMPOS_EDITAVEIS) {
    if (campo in (req.body ?? {})) {
      sets.push(`${campo} = ?`);
      const v = req.body[campo];
      valores.push(v === "" && ["due_date", "planned_date"].includes(campo) ? null : v);
    }
  }
  if (req.body?.status && req.body.status !== atual.status) {
    sets.push("done_at = ?");
    valores.push(req.body.status === "done" ? new Date().toISOString() : null);
  }
  if (!sets.length) return void res.json({ tarefa: atual });

  try {
    db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...valores, id);
  } catch (erro) {
    return void res.status(400).json({ erro: `Valor inválido: ${(erro as Error).message}` });
  }
  res.json({ tarefa: buscarTarefa(id) });
});

tasksRouter.delete("/:id", async (req, res) => {
  const tarefa = buscarTarefa(Number(req.params.id));
  if (!tarefa) return void res.status(404).json({ erro: "Tarefa não encontrada." });
  db.prepare("DELETE FROM tasks WHERE id = ?").run(tarefa.id);
  if (tarefa.notion_page_id) await arquivarNoNotion(tarefa.notion_page_id);
  res.status(204).end();
});
