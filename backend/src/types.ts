export type Status = "inbox" | "todo" | "done";
/** Matriz de Eisenhower: 1 = fazer agora, 2 = agendar, 3 = delegar/minimizar, 4 = eliminar. */
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
  notion_page_id: string | null;
}

export interface Evento {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  all_day: number;
  location: string;
  source: "manual" | "google";
  external_id: string | null;
}

export interface Pomodoro {
  id: number;
  task_id: number | null;
  started_at: string;
  ended_at: string;
  minutes: number;
  interrupted: number;
}

export interface Checkin {
  date: string;
  energy: number;
  mood: number;
  sleep_hours: number | null;
  habits: string[];
  note: string;
}
