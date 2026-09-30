const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function partes(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  return { dt: new Date(Date.UTC(a, m - 1, d)), d, m };
}

/** "seg, 29 set" */
export function dataCurta(data: string): string {
  const { dt, d, m } = partes(data);
  return `${DIAS[dt.getUTCDay()]}, ${d} ${MESES[m - 1]}`;
}

export function diaSemana(data: string): string {
  return DIAS[partes(data).dt.getUTCDay()];
}

export function diaMes(data: string): string {
  const { d, m } = partes(data);
  return `${d}/${String(m).padStart(2, "0")}`;
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataLocalDe(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function relativo(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

export const numero = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const QUADRANTES: Record<number, { nome: string; acao: string; dica: string }> = {
  1: { nome: "Q1 · Fazer agora", acao: "Fazer agora", dica: "Urgente e importante" },
  2: { nome: "Q2 · Agendar", acao: "Agendar", dica: "Importante, não urgente — onde mora o progresso" },
  3: { nome: "Q3 · Delegar", acao: "Delegar / agrupar", dica: "Urgente, pouco importante" },
  4: { nome: "Q4 · Eliminar", acao: "Eliminar", dica: "Nem urgente nem importante" },
};
