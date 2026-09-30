// Caminhos relativos: em dev o Vite faz proxy de /api pro backend; em produção o Traefik
// roteia /api pro backend no mesmo domínio. A sessão vai num cookie httpOnly.

export type Status = "inbox" | "todo" | "done";
export type Quadrante = 1 | 2 | 3 | 4;

export interface Tarefa {
  id: number;
  title: string;
  notes: string;
  status: Status;
  quadrant: Quadrante | null;
  estimate: number;
  context: string;
  project: string;
  due_date: string | null;
  planned_date: string | null;
  ai_note: string;
  created_at: string;
  done_at: string | null;
}

export interface Evento {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  all_day: number;
  location: string;
  source: "manual" | "google";
}

export interface Settings {
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  dailyCapacity: number;
  habits: string[];
  workStart: string;
  workEnd: string;
}

export interface Checkin {
  date: string;
  energy: number;
  mood: number;
  sleep_hours: number | null;
  habits: string[];
  note: string;
}

export interface RespostaIA<T> {
  modo: "openai" | "heuristica";
  modelo?: string;
  resultado: T;
  aviso?: string;
}

export interface SugestaoTriagem {
  id: number;
  titulo: string;
  quadrante: number;
  estimativa: number;
  contexto: string;
  projeto: string;
  prazo: string | null;
  justificativa: string;
}

export interface Plano {
  resumo: string;
  alocacoes: { task_id: number; data: string | null; motivo: string }[];
  alertas: string[];
  blocos_foco: { data: string; periodo: string; tema: string }[];
}

export interface Mensagem {
  assunto: string;
  mensagem: string;
  pontos_de_atencao: string[];
}

export interface Semana {
  inicio: string;
  dias: string[];
  hoje: string;
  eventos: Evento[];
  tarefas: Tarefa[];
  naoPlanejadas: Tarefa[];
  capacidade: number;
}

export interface Painel {
  periodo: { inicio: string; fim: string; dias: number };
  serie: {
    data: string;
    pomodoros: number;
    minutosFoco: number;
    concluidas: number;
    energia: number | null;
    humor: number | null;
    sono: number | null;
    habitos: number | null;
  }[];
  semanaAtual: ResumoSemana;
  semanaAnterior: ResumoSemana;
  minutosPorQuadrante: Record<string, number>;
  minutosPorProjeto: Record<string, number>;
  habitos: { habito: string; taxa: number }[];
  sequenciaCheckin: number;
  aderenciaPlano: { planejadas: number; concluidas: number };
  caixaDeEntrada: number;
  atrasadas: number;
  pomodorosForaDoHorario: number;
  usoIA: { kind: string; mode: string; n: number }[];
}

export interface ResumoSemana {
  pomodoros: number;
  horasFoco: number;
  concluidas: number;
  taxaInterrupcao: number;
}

export interface Integracoes {
  ia: { configurado: boolean; provedor: "openai" | null; modelo: string | null };
  google: { configurado: boolean; ultimaSync: string | null };
  notion: { configurado: boolean; ultimaSync: string | null; url: string | null };
}

export class NaoAutenticado extends Error {}

let aoPerderSessao: () => void = () => {};
export function quandoPerderSessao(fn: () => void) {
  aoPerderSessao = fn;
}

async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resp = await fetch(`/api${caminho}`, {
    method: metodo,
    credentials: "same-origin",
    headers: corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (resp.status === 401 && caminho !== "/login") {
    aoPerderSessao();
    throw new NaoAutenticado("Sessão expirada.");
  }
  if (resp.status === 204) return undefined as T;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.erro ?? `Erro HTTP ${resp.status}`);
  return json as T;
}

export const api = {
  me: () => req<{ autenticado: boolean }>("GET", "/me"),
  login: (senha: string) => req<{ ok: boolean }>("POST", "/login", { senha }),
  logout: () => req<{ ok: boolean }>("POST", "/logout"),

  tarefas: (status?: Status) => req<{ tarefas: Tarefa[] }>("GET", `/tarefas${status ? `?status=${status}` : ""}`),
  capturar: (title: string) => req<{ tarefas: Tarefa[] }>("POST", "/tarefas", { title }),
  atualizarTarefa: (id: number, campos: Partial<Tarefa>) => req<{ tarefa: Tarefa }>("PATCH", `/tarefas/${id}`, campos),
  apagarTarefa: (id: number) => req<void>("DELETE", `/tarefas/${id}`),

  registrarPomodoro: (p: { task_id: number | null; started_at: string; ended_at: string; minutes: number; interrupted: boolean }) =>
    req("POST", "/pomodoros", p),
  pomodorosHoje: () => req<{ pomodoros: { id: number; task_title: string | null; minutes: number; interrupted: number; started_at: string }[] }>("GET", "/pomodoros/hoje"),

  semana: (inicio?: string) => req<Semana>("GET", `/semana${inicio ? `?inicio=${inicio}` : ""}`),
  criarEvento: (e: { title: string; start_at: string; end_at: string; location?: string }) => req("POST", "/eventos", e),
  apagarEvento: (id: number) => req<void>("DELETE", `/eventos/${id}`),

  checkin: (data: string) => req<{ checkin: Checkin | null }>("GET", `/checkin/${data}`),
  salvarCheckin: (data: string, c: Omit<Checkin, "date">) => req("PUT", `/checkin/${data}`, c),

  painel: (dias = 14) => req<Painel>("GET", `/painel?dias=${dias}`),

  statusIA: () =>
    req<{ disponivel: boolean; tiposMensagem: Record<string, string>; log: { kind: string; mode: string; summary: string; created_at: string }[] }>(
      "GET",
      "/ia/status",
    ),
  triar: () => req<RespostaIA<SugestaoTriagem[]>>("POST", "/ia/triagem"),
  aplicarTriagem: (itens: SugestaoTriagem[]) => req("POST", "/ia/triagem/aplicar", { itens }),
  planejar: (inicio: string) => req<RespostaIA<Plano>>("POST", "/ia/plano", { inicio }),
  aplicarPlano: (alocacoes: Plano["alocacoes"]) => req("POST", "/ia/plano/aplicar", { alocacoes }),
  redigir: (dados: { tipo: string; rascunho: string; destinatario: string; tom: string }) =>
    req<RespostaIA<Mensagem>>("POST", "/ia/mensagem", dados),
  mensagens: () => req<{ mensagens: { id: number; kind: string; output: string; created_at: string }[] }>("GET", "/ia/mensagens"),
  standup: (impedimentos: string) => req<RespostaIA<{ texto: string }>>("POST", "/ia/standup", { impedimentos }),
  revisao: (inicio?: string) => req<RespostaIA<{ markdown: string }>>("POST", "/ia/revisao", { inicio }),
  revisoes: () => req<{ revisoes: { id: number; week_start: string; content: string; created_at: string }[] }>("GET", "/ia/revisoes"),

  integracoes: () => req<Integracoes>("GET", "/integracoes"),
  syncGoogle: () => req<{ importados: number; removidos: number }>("POST", "/integracoes/google/sync"),
  syncNotion: () => req<{ criadas: number; atualizadas: number; url: string }>("POST", "/integracoes/notion/sync"),

  settings: () => req<{ settings: Settings }>("GET", "/settings"),
  salvarSettings: (s: Partial<Settings>) => req<{ settings: Settings }>("PUT", "/settings", s),
};
