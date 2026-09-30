// Popula o banco com ~3 semanas de uso realista, pra o painel ter histórico na demonstração.
// Uso: npm run seed            (só roda se o banco estiver vazio)
//      npm run seed -- --force (apaga tudo e recria)
import { db, lerSettings } from "./db.js";
import { hoje, inicioDaSemana, somarDias } from "./lib/dates.js";

const forcar = process.argv.includes("--force");
const { n } = db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as { n: number };
if (n > 0 && !forcar) {
  console.log("O banco já tem dados. Use `npm run seed -- --force` para recriar.");
  process.exit(0);
}

db.exec("DELETE FROM pomodoros; DELETE FROM tasks; DELETE FROM events; DELETE FROM checkins; DELETE FROM reviews; DELETE FROM messages; DELETE FROM ai_log;");

// Gerador pseudoaleatório determinístico: o seed gera sempre o mesmo "histórico".
let semente = 42;
const rand = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const escolher = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const local = (data: string, hora: string) => new Date(`${data}T${hora}:00`).toISOString();
const diaUtil = (data: string) => {
  const d = new Date(`${data}T12:00:00`).getDay();
  return d !== 0 && d !== 6;
};

const HOJE = hoje();
const SEMANA = inicioDaSemana(HOJE);
const INICIO = somarDias(SEMANA, -14);

type Semente = [titulo: string, projeto: string, quadrante: 1 | 2 | 3 | 4, estimativa: number, contexto: string];
const HISTORICO: Semente[] = [
  ["Corrigir cálculo de comissão no Voltzan CRM", "Voltzan CRM", 1, 3, "@computador"],
  ["Responder chamado de NF-e rejeitada do ERP", "ERP Cliente", 1, 2, "@computador"],
  ["Modelar tabela de metas de vendas", "Voltzan CRM", 2, 4, "@computador"],
  ["Estudar Docker Swarm para o deploy", "Faculdade", 2, 3, "@computador"],
  ["Escrever parte teórica de Integração de APIs", "Faculdade", 2, 4, "@computador"],
  ["Revisar PR do módulo financeiro", "ERP Cliente", 2, 2, "@computador"],
  ["Ligar para contador sobre DAS", "Pessoal", 3, 1, "@telefone"],
  ["Atualizar planilha de horas do mês", "EV Digital", 3, 1, "@computador"],
  ["Migrar landing page da EV Digital pro Next 15", "EV Digital", 2, 5, "@computador"],
  ["Hotfix: dashboard fora do ar em produção", "Voltzan CRM", 1, 2, "@computador"],
  ["Preparar reunião de alinhamento com cliente", "ERP Cliente", 1, 1, "@computador"],
  ["Gravar vídeo pitch do trabalho de APIs", "Faculdade", 1, 2, "@casa"],
  ["Agendar consulta no dentista", "Saúde", 3, 1, "@telefone"],
  ["Documentar endpoints de estoque", "ERP Cliente", 2, 3, "@computador"],
  ["Configurar backup automático do Postgres", "Voltzan CRM", 2, 2, "@computador"],
  ["Responder e-mails de orçamento", "EV Digital", 3, 1, "@computador"],
  ["Ler capítulo de Deep Work", "Pessoal", 2, 1, "@casa"],
  ["Renovar domínio gustavomartins.dev", "Pessoal", 1, 1, "@computador"],
  ["Refatorar autenticação do app mobile", "EV Digital", 2, 4, "@computador"],
  ["Enviar relatório semanal ao cliente do ERP", "ERP Cliente", 3, 1, "@computador"],
];

const inserirTarefa = db.prepare(`
  INSERT INTO tasks (title, status, quadrant, estimate, context, project, due_date, planned_date, ai_note, created_at, done_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const inserirPomodoro = db.prepare(
  "INSERT INTO pomodoros (task_id, started_at, ended_at, minutes, interrupted) VALUES (?, ?, ?, ?, ?)",
);

db.exec("BEGIN");

// Semanas anteriores: tarefas concluídas + pomodoros. A primeira semana é mais "caótica"
// (mais Q1, trabalho à noite, mais interrupções) e vai melhorando — como no uso real do sistema.
const diasPassados: string[] = [];
for (let d = INICIO; d < HOJE; d = somarDias(d, 1)) diasPassados.push(d);

let idx = 0;
for (const dia of diasPassados) {
  if (!diaUtil(dia)) continue;
  const semanaNum = Math.floor((Date.parse(dia) - Date.parse(INICIO)) / (7 * 86_400_000)); // 0, 1, 2
  const tarefasDoDia = 2 + Math.floor(rand() * 2);
  let hora = 8.5 + rand() * 0.5;
  for (let k = 0; k < tarefasDoDia; k++) {
    const [titulo, projeto, quadrante, estimativa, contexto] = HISTORICO[idx++ % HISTORICO.length];
    const criada = local(somarDias(dia, -2), "09:00");
    const r = inserirTarefa.run(
      titulo, "done", quadrante, estimativa, contexto, projeto, null, dia, "Classificada na triagem da manhã.", criada, null,
    );
    const taskId = Number(r.lastInsertRowid);
    for (let p = 0; p < estimativa; p++) {
      const interrompido = rand() < [0.3, 0.18, 0.08][semanaNum];
      const minutos = interrompido ? 8 + Math.floor(rand() * 12) : 25;
      const h = Math.floor(hora);
      const m = Math.round((hora - h) * 60);
      const inicio = local(dia, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      const fim = new Date(Date.parse(inicio) + minutos * 60_000).toISOString();
      inserirPomodoro.run(taskId, inicio, fim, minutos, interrompido ? 1 : 0);
      hora += (minutos + (p % 4 === 3 ? 15 : 5)) / 60;
      if (hora > 12 && hora < 13.5) hora = 13.5; // almoço
    }
    db.prepare("UPDATE tasks SET done_at = ? WHERE id = ?").run(
      new Date(Date.parse(local(dia, "08:00")) + (hora - 8) * 3_600_000).toISOString(),
      taskId,
    );
  }
  // Primeira semana: "só mais um" à noite, que o sistema depois ajuda a cortar.
  if (semanaNum === 0 && rand() < 0.7) {
    inserirPomodoro.run(null, local(dia, "21:10"), local(dia, "21:35"), 25, 0);
    inserirPomodoro.run(null, local(dia, "21:40"), local(dia, "22:05"), 25, 0);
  }
}

// Semana atual: tarefas a fazer, algumas planejadas, uma atrasada.
const ABERTAS: [string, string, 1 | 2 | 3 | 4, number, string, number | null, number | null][] = [
  // título, projeto, quadrante, estimativa, contexto, prazo (dias a partir de hoje), planejada (dias a partir de hoje)
  ["Finalizar relatório de comissões do Voltzan CRM", "Voltzan CRM", 1, 3, "@computador", 1, 0],
  ["Revisar contrato de manutenção do ERP", "ERP Cliente", 1, 1, "@computador", 0, 0],
  ["Montar trabalho de Produtividade e Gestão do Tempo", "Faculdade", 2, 6, "@computador", 6, 1],
  ["Escrever testes do módulo de estoque", "ERP Cliente", 2, 4, "@computador", null, 2],
  ["Planejar arquitetura do app de agendamento da EV Digital", "EV Digital", 2, 3, "@computador", null, null],
  ["Estudar filas com BullMQ", "Pessoal", 2, 2, "@computador", null, null],
  ["Responder grupo do condomínio", "Pessoal", 3, 1, "@telefone", null, null],
  ["Emitir nota fiscal de setembro", "Pessoal", 1, 1, "@computador", -1, null],
  ["Organizar pasta de downloads", "Pessoal", 4, 1, "@computador", null, null],
];
for (const [titulo, projeto, q, est, ctx, prazo, plan] of ABERTAS) {
  inserirTarefa.run(
    titulo, "todo", q, est, ctx, projeto,
    prazo == null ? null : somarDias(HOJE, prazo),
    plan == null ? null : somarDias(HOJE, plan),
    "Classificada na triagem da manhã.",
    local(somarDias(HOJE, -3), "08:30"), null,
  );
}

// Pomodoros de hoje de manhã, se já passou das 10h.
const agora = new Date();
if (agora.getHours() >= 10) {
  const primeira = db.prepare("SELECT id FROM tasks WHERE status = 'todo' ORDER BY quadrant LIMIT 1").get() as { id: number };
  inserirPomodoro.run(primeira.id, local(HOJE, "08:40"), local(HOJE, "09:05"), 25, 0);
  inserirPomodoro.run(primeira.id, local(HOJE, "09:10"), local(HOJE, "09:35"), 25, 0);
}

// Caixa de entrada com capturas "cruas", do jeito que chegam — pra demonstrar a triagem com IA.
for (const cru of [
  "cliente do ERP pediu relatório de estoque parado até sexta",
  "ver aquele bug do login que o João comentou no grupo",
  "comprar presente aniversário da minha mãe (domingo)",
  "ideia: automatizar o fechamento de horas com n8n",
  "prova de Banco de Dados semana que vem, revisar normalização",
  "responder whats do Rafael sobre orçamento do site",
]) {
  db.prepare("INSERT INTO tasks (title) VALUES (?)").run(cru);
}

// Compromissos (manuais — com a Google Agenda configurada, eles vêm de lá).
const inserirEvento = db.prepare("INSERT INTO events (title, start_at, end_at, source) VALUES (?, ?, ?, 'manual')");
for (let i = 0; i < 7; i++) {
  const dia = somarDias(SEMANA, i);
  if (!diaUtil(dia)) continue;
  inserirEvento.run("Daily Voltzan", local(dia, "09:30"), local(dia, "09:45"));
  if (i === 1 || i === 3) inserirEvento.run("Aula ao vivo — Faculdade", local(dia, "19:00"), local(dia, "20:30"));
}
inserirEvento.run("Reunião de alinhamento — ERP Cliente", local(somarDias(SEMANA, 2), "14:00"), local(somarDias(SEMANA, 2), "15:00"));
inserirEvento.run("Call de proposta — EV Digital", local(somarDias(SEMANA, 3), "10:00"), local(somarDias(SEMANA, 3), "10:45"));
inserirEvento.run("Academia", local(somarDias(SEMANA, 0), "18:30"), local(somarDias(SEMANA, 0), "19:30"));
inserirEvento.run("Academia", local(somarDias(SEMANA, 2), "18:30"), local(somarDias(SEMANA, 2), "19:30"));
inserirEvento.run("Academia", local(somarDias(SEMANA, 4), "18:30"), local(somarDias(SEMANA, 4), "19:30"));

// Check-ins: energia e sono melhorando ao longo das semanas; hábitos cada vez mais cumpridos.
const habitos = lerSettings().habits;
for (const dia of diasPassados) {
  const semanaNum = Math.floor((Date.parse(dia) - Date.parse(INICIO)) / (7 * 86_400_000));
  if (rand() < 0.12) continue; // alguns dias sem check-in
  const base = [2.4, 3.2, 3.8][semanaNum];
  const energia = Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 1.6)));
  const humor = Math.max(1, Math.min(5, Math.round(base + 0.3 + (rand() - 0.5) * 1.4)));
  const sono = Math.round(([5.8, 6.6, 7.2][semanaNum] + (rand() - 0.5)) * 2) / 2;
  const feitos = habitos.filter(() => rand() < [0.35, 0.55, 0.75][semanaNum]);
  db.prepare("INSERT INTO checkins (date, energy, mood, sleep_hours, habits, note) VALUES (?, ?, ?, ?, ?, '')").run(
    dia, energia, humor, sono, JSON.stringify(feitos),
  );
}

// Histórico de uso da IA, pra o painel mostrar a IA trabalhando no dia a dia.
const tiposIA = ["triagem", "triagem", "plano_semanal", "comunicacao", "standup", "comunicacao"];
for (const dia of diasPassados.filter(diaUtil)) {
  db.prepare("INSERT INTO ai_log (kind, mode, summary, created_at) VALUES (?, 'openai', 'histórico de exemplo', ?)").run(
    escolher(tiposIA), local(dia, "08:15"),
  );
}

db.exec("COMMIT");
console.log(`Seed concluído: histórico de ${INICIO} até ${HOJE}.`);
