import { config } from "../config.js";

// Todas as datas "de calendário" (hoje, semana, dia planejado) são strings YYYY-MM-DD
// no fuso do usuário; timestamps (início de pomodoro, conclusão de tarefa) são ISO em UTC.

export function dataLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function hoje(): string {
  return dataLocal();
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Segunda-feira da semana que contém `data`. */
export function inicioDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  return somarDias(data, deslocamento);
}

export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function nomeDoDia(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return NOMES_DIA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** Hora local "HH:MM" de um timestamp. */
export function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: config.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
