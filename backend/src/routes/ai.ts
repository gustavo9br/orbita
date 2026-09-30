import { Router } from "express";
import { db, lerSettings } from "../db.js";
import {
  gerarRevisaoSemanal,
  gerarStandup,
  iaDisponivel,
  planejarSemana,
  redigirMensagem,
  TIPOS_MENSAGEM,
  triarCaixaDeEntrada,
  type TipoMensagem,
} from "../lib/ai.js";
import { diasDaSemana, hoje, inicioDaSemana, somarDias } from "../lib/dates.js";
import type { Evento, Tarefa } from "../types.js";
import { dadosDaRevisao } from "./dashboard.js";

export const aiRouter = Router();

aiRouter.get("/status", (_req, res) => {
  const log = db.prepare("SELECT * FROM ai_log ORDER BY id DESC LIMIT 15").all();
  res.json({ disponivel: iaDisponivel(), tiposMensagem: TIPOS_MENSAGEM, log });
});

// --- Triagem: a IA sugere, o usuário revisa e confirma -----------------------

aiRouter.post("/triagem", async (_req, res) => {
  const inbox = db.prepare("SELECT * FROM tasks WHERE status = 'inbox' ORDER BY id").all() as unknown as Tarefa[];
  if (!inbox.length) return void res.json({ modo: "heuristica", resultado: [] });
  const projetos = (
    db.prepare("SELECT DISTINCT project FROM tasks WHERE project != '' ORDER BY project").all() as { project: string }[]
  ).map((p) => p.project);
  res.json(await triarCaixaDeEntrada(inbox, projetos));
});

aiRouter.post("/triagem/aplicar", (req, res) => {
  const itens = (req.body?.itens ?? []) as {
    id: number;
    titulo: string;
    quadrante: number;
    estimativa: number;
    contexto: string;
    projeto: string;
    prazo: string | null;
    justificativa: string;
  }[];
  const atualizar = db.prepare(`
    UPDATE tasks SET title = ?, quadrant = ?, estimate = ?, context = ?, project = ?, due_date = ?, ai_note = ?, status = 'todo'
    WHERE id = ? AND status = 'inbox'
  `);
  db.exec("BEGIN");
  for (const i of itens) {
    atualizar.run(i.titulo, i.quadrante, i.estimativa, i.contexto, i.projeto, i.prazo || null, i.justificativa, i.id);
  }
  db.exec("COMMIT");
  res.json({ aplicadas: itens.length });
});

// --- Planejamento semanal ----------------------------------------------------

aiRouter.post("/plano", async (req, res) => {
  const inicio = inicioDaSemana(String(req.body?.inicio ?? hoje()));
  const dias = diasDaSemana(inicio);
  const tarefas = db
    .prepare("SELECT * FROM tasks WHERE status = 'todo' AND (planned_date IS NULL OR planned_date >= ?) ORDER BY id")
    .all(hoje()) as unknown as Tarefa[];
  const eventos = db
    .prepare("SELECT * FROM events WHERE start_at >= ? AND start_at < ? ORDER BY start_at")
    .all(new Date(`${dias[0]}T00:00:00`).toISOString(), new Date(`${somarDias(dias[6], 1)}T00:00:00`).toISOString()) as unknown as Evento[];
  const settings = lerSettings();
  const energia = db
    .prepare("SELECT AVG(energy) AS media FROM checkins WHERE date >= ?")
    .get(somarDias(hoje(), -7)) as { media: number | null };

  res.json(
    await planejarSemana({
      dias,
      tarefas,
      eventos,
      capacidadeDiaria: settings.dailyCapacity,
      inicioExpediente: settings.workStart,
      fimExpediente: settings.workEnd,
      energiaMedia: energia.media,
    }),
  );
});

aiRouter.post("/plano/aplicar", (req, res) => {
  const alocacoes = (req.body?.alocacoes ?? []) as { task_id: number; data: string | null }[];
  const atualizar = db.prepare("UPDATE tasks SET planned_date = ? WHERE id = ?");
  db.exec("BEGIN");
  for (const a of alocacoes) if (a.data) atualizar.run(a.data, a.task_id);
  db.exec("COMMIT");
  res.json({ aplicadas: alocacoes.filter((a) => a.data).length });
});

// --- Comunicação ---------------------------------------------------------------

aiRouter.post("/mensagem", async (req, res) => {
  const tipo = String(req.body?.tipo ?? "status") as TipoMensagem;
  const rascunho = String(req.body?.rascunho ?? "").trim();
  if (!(tipo in TIPOS_MENSAGEM)) return void res.status(400).json({ erro: "Tipo de mensagem inválido." });
  if (!rascunho) return void res.status(400).json({ erro: "Escreva o rascunho ou as anotações." });
  const resposta = await redigirMensagem(tipo, rascunho, String(req.body?.destinatario ?? ""), String(req.body?.tom ?? ""));
  db.prepare("INSERT INTO messages (kind, input, output) VALUES (?, ?, ?)").run(
    tipo,
    rascunho,
    resposta.resultado.mensagem,
  );
  res.json(resposta);
});

aiRouter.get("/mensagens", (_req, res) => {
  res.json({ mensagens: db.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 10").all() });
});

aiRouter.post("/standup", async (req, res) => {
  const ontem = somarDias(hoje(), -1);
  const concluidasOntem = db
    .prepare("SELECT * FROM tasks WHERE status = 'done' AND done_at >= ? AND done_at < ?")
    .all(new Date(`${ontem}T00:00:00`).toISOString(), new Date(`${hoje()}T00:00:00`).toISOString()) as unknown as Tarefa[];
  const planejadasHoje = db
    .prepare("SELECT * FROM tasks WHERE status = 'todo' AND planned_date = ? ORDER BY COALESCE(quadrant, 5)")
    .all(hoje()) as unknown as Tarefa[];
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM pomodoros WHERE interrupted = 0 AND started_at >= ? AND started_at < ?")
    .get(new Date(`${ontem}T00:00:00`).toISOString(), new Date(`${hoje()}T00:00:00`).toISOString()) as { n: number };
  res.json(
    await gerarStandup({
      concluidasOntem,
      planejadasHoje,
      pomodorosOntem: n,
      impedimentos: String(req.body?.impedimentos ?? ""),
    }),
  );
});

// --- Revisão semanal -------------------------------------------------------------

aiRouter.post("/revisao", async (req, res) => {
  const inicio = inicioDaSemana(String(req.body?.inicio ?? hoje()));
  const resposta = await gerarRevisaoSemanal(dadosDaRevisao(inicio));
  db.prepare("INSERT INTO reviews (week_start, content) VALUES (?, ?)").run(inicio, resposta.resultado.markdown);
  res.json(resposta);
});

aiRouter.get("/revisoes", (_req, res) => {
  res.json({ revisoes: db.prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 8").all() });
});
