import { Router } from "express";
import { db, lerSettings } from "../db.js";
import type { EntradaRevisao } from "../lib/ai.js";
import { dataLocal, diasDaSemana, hoje, horaLocal, inicioDaSemana, somarDias } from "../lib/dates.js";
import type { Pomodoro, Tarefa } from "../types.js";

export const dashboardRouter = Router();

interface PomodoroComTarefa extends Pomodoro {
  quadrant: number | null;
  project: string | null;
}

interface CheckinLinha {
  date: string;
  energy: number;
  mood: number;
  sleep_hours: number | null;
  habits: string;
  note: string;
}

const inicioDoDia = (data: string) => new Date(`${data}T00:00:00`).toISOString();

function pomodorosEntre(de: string, ate: string): PomodoroComTarefa[] {
  return db
    .prepare(
      `SELECT p.*, t.quadrant, t.project FROM pomodoros p LEFT JOIN tasks t ON t.id = p.task_id
       WHERE p.started_at >= ? AND p.started_at < ? ORDER BY p.started_at`,
    )
    .all(inicioDoDia(de), inicioDoDia(somarDias(ate, 1))) as unknown as PomodoroComTarefa[];
}

function concluidasEntre(de: string, ate: string): Tarefa[] {
  return db
    .prepare("SELECT * FROM tasks WHERE status = 'done' AND done_at >= ? AND done_at < ?")
    .all(inicioDoDia(de), inicioDoDia(somarDias(ate, 1))) as unknown as Tarefa[];
}

function checkinsEntre(de: string, ate: string) {
  return (db.prepare("SELECT * FROM checkins WHERE date >= ? AND date <= ? ORDER BY date").all(de, ate) as unknown as CheckinLinha[]).map(
    (c) => ({ ...c, habits: JSON.parse(c.habits) as string[] }),
  );
}

function foraDoHorario(p: Pomodoro): boolean {
  const { workStart, workEnd } = lerSettings();
  const h = horaLocal(p.started_at);
  return h < workStart || h >= workEnd;
}

function somarPor<T>(itens: T[], chave: (i: T) => string, valor: (i: T) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of itens) out[chave(i)] = (out[chave(i)] ?? 0) + valor(i);
  return out;
}

/** Resumo de uma semana até `fim` (por padrão, a semana inteira). */
function resumoSemana(inicio: string, fim = somarDias(inicio, 6)) {
  const poms = pomodorosEntre(inicio, fim);
  const foco = poms.filter((p) => !p.interrupted);
  return {
    pomodoros: foco.length,
    horasFoco: foco.reduce((a, p) => a + p.minutes, 0) / 60,
    concluidas: concluidasEntre(inicio, fim).length,
    taxaInterrupcao: poms.length ? (poms.length - foco.length) / poms.length : 0,
  };
}

dashboardRouter.get("/", (req, res) => {
  const dias = Math.min(60, Math.max(7, Number(req.query.dias ?? 14)));
  const fim = hoje();
  const inicio = somarDias(fim, -(dias - 1));
  const settings = lerSettings();

  const poms = pomodorosEntre(inicio, fim);
  const foco = poms.filter((p) => !p.interrupted);
  const concluidas = concluidasEntre(inicio, fim);
  const checkins = checkinsEntre(inicio, fim);
  const checkinPorDia = new Map(checkins.map((c) => [c.date, c]));

  const serie = Array.from({ length: dias }, (_, i) => {
    const data = somarDias(inicio, i);
    const doDia = foco.filter((p) => dataLocal(new Date(p.started_at)) === data);
    const c = checkinPorDia.get(data);
    return {
      data,
      pomodoros: doDia.length,
      minutosFoco: doDia.reduce((a, p) => a + p.minutes, 0),
      concluidas: concluidas.filter((t) => t.done_at && dataLocal(new Date(t.done_at)) === data).length,
      energia: c?.energy ?? null,
      humor: c?.mood ?? null,
      sono: c?.sleep_hours ?? null,
      habitos: c ? c.habits.length : null,
    };
  });

  const minutosPorQuadrante = somarPor(foco, (p) => (p.quadrant ? `Q${p.quadrant}` : "Sem tarefa"), (p) => p.minutes);
  const minutosPorProjeto = somarPor(foco, (p) => p.project || "Sem projeto", (p) => p.minutes);

  const habitos = settings.habits.map((h) => ({
    habito: h,
    taxa: checkins.length ? checkins.filter((c) => c.habits.includes(h)).length / checkins.length : 0,
  }));

  // Sequência de dias seguidos com check-in, contando de hoje (ou ontem, se hoje ainda não teve).
  let sequencia = 0;
  let cursor = db.prepare("SELECT 1 FROM checkins WHERE date = ?").get(fim) ? fim : somarDias(fim, -1);
  while (db.prepare("SELECT 1 FROM checkins WHERE date = ?").get(cursor)) {
    sequencia++;
    cursor = somarDias(cursor, -1);
  }

  const semana = inicioDaSemana(fim);
  const planejadasSemana = db
    .prepare("SELECT status FROM tasks WHERE planned_date >= ? AND planned_date <= ?")
    .all(semana, somarDias(semana, 6)) as { status: string }[];

  const contagem = (sql: string, ...params: string[]) => (db.prepare(sql).get(...params) as { n: number }).n;

  res.json({
    periodo: { inicio, fim, dias },
    serie,
    semanaAtual: resumoSemana(semana),
    // Comparação justa: semana passada só até o mesmo dia da semana de hoje.
    semanaAnterior: resumoSemana(somarDias(semana, -7), somarDias(fim, -7)),
    minutosPorQuadrante,
    minutosPorProjeto,
    habitos,
    sequenciaCheckin: sequencia,
    aderenciaPlano: {
      planejadas: planejadasSemana.length,
      concluidas: planejadasSemana.filter((t) => t.status === "done").length,
    },
    caixaDeEntrada: contagem("SELECT COUNT(*) AS n FROM tasks WHERE status = 'inbox'"),
    atrasadas: contagem("SELECT COUNT(*) AS n FROM tasks WHERE status = 'todo' AND due_date < ?", fim),
    pomodorosForaDoHorario: foco.filter(foraDoHorario).length,
    usoIA: db
      .prepare("SELECT kind, mode, COUNT(*) AS n FROM ai_log WHERE created_at >= ? GROUP BY kind, mode")
      .all(inicioDoDia(inicio)),
  });
});

/** Dados consolidados de uma semana para a revisão semanal da IA. */
export function dadosDaRevisao(inicio: string): EntradaRevisao {
  const dias = diasDaSemana(inicio);
  const fim = dias[6];
  const poms = pomodorosEntre(inicio, fim);
  const foco = poms.filter((p) => !p.interrupted);
  const concluidas = concluidasEntre(inicio, fim);
  return {
    semana: inicio,
    concluidas,
    pendentes: db
      .prepare("SELECT * FROM tasks WHERE status = 'todo' AND (planned_date <= ? OR due_date <= ?)")
      .all(fim, fim) as unknown as Tarefa[],
    pomodorosPorDia: Object.fromEntries(dias.map((d) => [d, foco.filter((p) => dataLocal(new Date(p.started_at)) === d).length])),
    interrompidos: poms.length - foco.length,
    minutosPorProjeto: somarPor(foco, (p) => p.project || "Sem projeto", (p) => p.minutes),
    porQuadrante: somarPor(concluidas, (t) => String(t.quadrant ?? "sem"), () => 1),
    checkins: checkinsEntre(inicio, fim).map(({ note: _note, ...c }) => c),
    habitos: lerSettings().habits,
    pomodorosForaDoHorario: foco.filter(foraDoHorario).length,
  };
}
