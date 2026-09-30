import { Router } from "express";
import { db, lerSettings, lerValor, salvarSettings } from "../db.js";
import { descricaoIA } from "../lib/ai.js";
import { sincronizarGoogleAgenda } from "../lib/calendar.js";
import { diasDaSemana, hoje, inicioDaSemana, somarDias } from "../lib/dates.js";
import { notionConfigurado, sincronizarNotion } from "../lib/notion.js";
import { config } from "../config.js";
import type { Checkin, Evento, Pomodoro, Tarefa } from "../types.js";

// Rotas da rotina diária: pomodoros, compromissos, check-in, semana, integrações e ajustes.
export const rotinaRouter = Router();

// --- Pomodoro --------------------------------------------------------------------

rotinaRouter.post("/pomodoros", (req, res) => {
  const { task_id, started_at, ended_at, minutes, interrupted } = req.body ?? {};
  if (!started_at || !ended_at || !Number.isFinite(minutes)) {
    return void res.status(400).json({ erro: "started_at, ended_at e minutes são obrigatórios." });
  }
  const r = db
    .prepare("INSERT INTO pomodoros (task_id, started_at, ended_at, minutes, interrupted) VALUES (?, ?, ?, ?, ?)")
    .run(task_id ?? null, started_at, ended_at, Math.round(minutes), interrupted ? 1 : 0);
  res.status(201).json({ pomodoro: db.prepare("SELECT * FROM pomodoros WHERE id = ?").get(r.lastInsertRowid) });
});

rotinaRouter.get("/pomodoros/hoje", (_req, res) => {
  const pomodoros = db
    .prepare(
      `SELECT p.*, t.title AS task_title FROM pomodoros p LEFT JOIN tasks t ON t.id = p.task_id
       WHERE p.started_at >= ? ORDER BY p.started_at`,
    )
    .all(new Date(`${hoje()}T00:00:00`).toISOString()) as unknown as (Pomodoro & { task_title: string | null })[];
  res.json({ pomodoros });
});

// --- Compromissos ----------------------------------------------------------------

rotinaRouter.post("/eventos", (req, res) => {
  const { title, start_at, end_at, location } = req.body ?? {};
  if (!title || !start_at || !end_at) return void res.status(400).json({ erro: "Título, início e fim são obrigatórios." });
  if (new Date(end_at) <= new Date(start_at)) return void res.status(400).json({ erro: "O fim precisa ser depois do início." });
  const r = db
    .prepare("INSERT INTO events (title, start_at, end_at, location, source) VALUES (?, ?, ?, ?, 'manual')")
    .run(title, new Date(start_at).toISOString(), new Date(end_at).toISOString(), location ?? "");
  res.status(201).json({ evento: db.prepare("SELECT * FROM events WHERE id = ?").get(r.lastInsertRowid) });
});

rotinaRouter.delete("/eventos/:id", (req, res) => {
  const r = db.prepare("DELETE FROM events WHERE id = ? AND source = 'manual'").run(Number(req.params.id));
  if (!r.changes) return void res.status(404).json({ erro: "Compromisso não encontrado (eventos do Google são só leitura)." });
  res.status(204).end();
});

// --- Semana ------------------------------------------------------------------------

rotinaRouter.get("/semana", (req, res) => {
  const inicio = inicioDaSemana(String(req.query.inicio ?? hoje()));
  const dias = diasDaSemana(inicio);
  const eventos = db
    .prepare("SELECT * FROM events WHERE start_at >= ? AND start_at < ? ORDER BY start_at")
    .all(new Date(`${dias[0]}T00:00:00`).toISOString(), new Date(`${somarDias(dias[6], 1)}T00:00:00`).toISOString()) as unknown as Evento[];
  const tarefas = db
    .prepare("SELECT * FROM tasks WHERE planned_date >= ? AND planned_date <= ? ORDER BY COALESCE(quadrant, 5), id")
    .all(dias[0], dias[6]) as unknown as Tarefa[];
  const naoPlanejadas = db
    .prepare("SELECT * FROM tasks WHERE status = 'todo' AND (planned_date IS NULL OR planned_date < ?) ORDER BY COALESCE(quadrant, 5), COALESCE(due_date, '9999')")
    .all(hoje()) as unknown as Tarefa[];
  res.json({ inicio, dias, hoje: hoje(), eventos, tarefas, naoPlanejadas, capacidade: lerSettings().dailyCapacity });
});

// --- Check-in de bem-estar -----------------------------------------------------------

rotinaRouter.get("/checkin/:data", (req, res) => {
  const linha = db.prepare("SELECT * FROM checkins WHERE date = ?").get(req.params.data) as
    | (Omit<Checkin, "habits"> & { habits: string })
    | undefined;
  res.json({ checkin: linha ? { ...linha, habits: JSON.parse(linha.habits) } : null });
});

rotinaRouter.put("/checkin/:data", (req, res) => {
  const { energy, mood, sleep_hours, habits, note } = req.body ?? {};
  if (!(energy >= 1 && energy <= 5 && mood >= 1 && mood <= 5)) {
    return void res.status(400).json({ erro: "Energia e humor vão de 1 a 5." });
  }
  db.prepare(
    `INSERT INTO checkins (date, energy, mood, sleep_hours, habits, note) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET energy = excluded.energy, mood = excluded.mood,
       sleep_hours = excluded.sleep_hours, habits = excluded.habits, note = excluded.note`,
  ).run(req.params.data, energy, mood, sleep_hours ?? null, JSON.stringify(habits ?? []), note ?? "");
  res.json({ ok: true });
});

// --- Integrações --------------------------------------------------------------------

rotinaRouter.get("/integracoes", (_req, res) => {
  const bancoNotion = lerValor("notion_database_id");
  res.json({
    ia: { configurado: descricaoIA().provedor !== null, ...descricaoIA() },
    google: { configurado: Boolean(config.googleIcsUrl), ultimaSync: lerValor("google_sync_at") ?? null },
    notion: {
      configurado: notionConfigurado(),
      ultimaSync: lerValor("notion_sync_at") ?? null,
      url: bancoNotion ? `https://www.notion.so/${bancoNotion.replace(/-/g, "")}` : null,
    },
  });
});

rotinaRouter.post("/integracoes/google/sync", async (_req, res) => {
  try {
    res.json(await sincronizarGoogleAgenda());
  } catch (erro) {
    res.status(502).json({ erro: `Falha ao ler a Google Agenda: ${(erro as Error).message}` });
  }
});

rotinaRouter.post("/integracoes/notion/sync", async (_req, res) => {
  try {
    res.json(await sincronizarNotion());
  } catch (erro) {
    res.status(502).json({ erro: `Falha ao sincronizar com o Notion: ${(erro as Error).message}` });
  }
});

// --- Ajustes ------------------------------------------------------------------------

rotinaRouter.get("/settings", (_req, res) => res.json({ settings: lerSettings() }));
rotinaRouter.put("/settings", (req, res) => res.json({ settings: salvarSettings(req.body ?? {}) }));
