import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { config } from "../config.js";
import { registrarIA } from "../db.js";
import type { Evento, Tarefa } from "../types.js";
import { dataLocal, hoje, nomeDoDia, somarDias } from "./dates.js";

// Dois provedores possíveis, escolhidos por configuração (AI_PROVIDER ou pela chave que existir).
// Prompts e schemas são os mesmos; só a chamada muda.
type Provedor = "openai" | "claude";

const MODELO_CLAUDE = "claude-opus-5-5";

function escolherProvedor(): Provedor | null {
  if (config.aiProvider === "openai" && config.openaiApiKey) return "openai";
  if (config.aiProvider === "anthropic" && config.anthropicApiKey) return "claude";
  if (config.openaiApiKey) return "openai";
  if (config.anthropicApiKey) return "claude";
  return null;
}

const provedor = escolherProvedor();
const openai = provedor === "openai" ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
const anthropic = provedor === "claude" ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

export function iaDisponivel(): boolean {
  return provedor !== null;
}

export function descricaoIA(): { provedor: Provedor | null; modelo: string | null } {
  if (provedor === "openai") return { provedor, modelo: config.openaiModel };
  if (provedor === "claude") return { provedor, modelo: MODELO_CLAUDE };
  return { provedor: null, modelo: null };
}

export type ModoIA = Provedor | "heuristica";
export interface RespostaIA<T> {
  modo: ModoIA;
  modelo?: string;
  resultado: T;
  aviso?: string;
}

const SISTEMA = `Você é o copiloto de produtividade do "Órbita", o sistema operacional pessoal de um desenvolvedor full-stack brasileiro que divide o tempo entre projetos de clientes (ERPs/CRMs), a faculdade e a vida pessoal.
Princípios que você segue:
- GTD: toda entrada vira uma próxima ação concreta, começando com verbo no infinitivo ("Enviar", "Revisar", "Ligar").
- Matriz de Eisenhower: 1 = urgente e importante (fazer agora), 2 = importante e não urgente (agendar e proteger), 3 = urgente e não importante (delegar, agrupar ou minimizar), 4 = nem urgente nem importante (eliminar ou deixar pra depois).
- Pomodoro: estimativas em blocos de 25 minutos de foco.
- Sustentabilidade: capacidade realista, pausas e limites de horário importam tanto quanto entregas. Não incentive hora extra.
Escreva sempre em português do Brasil, direto e sem floreios.`;

/** Chama o provedor configurado com saída estruturada: a resposta volta validada pelo schema Zod. */
async function chamarEstruturado<T extends z.ZodType>(
  schema: T,
  prompt: string,
  esforco: "low" | "medium" | "high",
): Promise<z.infer<T>> {
  if (openai) return chamarOpenAI(schema, prompt, esforco);
  if (anthropic) return chamarClaude(schema, prompt, esforco);
  throw new Error("Nenhum provedor de IA configurado");
}

async function chamarOpenAI<T extends z.ZodType>(schema: T, prompt: string, esforco: "low" | "medium" | "high"): Promise<z.infer<T>> {
  const resposta = await openai!.responses.parse({
    model: config.openaiModel,
    instructions: SISTEMA,
    input: prompt,
    reasoning: { effort: esforco },
    text: { format: zodTextFormat(schema, "resposta") },
  });
  const recusa = resposta.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .find((c) => c.type === "refusal");
  if (recusa) throw new Error("A IA recusou esta solicitação. Tente reformular o texto.");
  if (resposta.output_parsed == null) throw new Error("A IA respondeu num formato inesperado.");
  return resposta.output_parsed as z.infer<T>;
}

/**
 * Claude com saída estruturada. Usa o fallback padrão do servidor pra que uma recusa por
 * classificador seja reprocessada em outro modelo em vez de falhar.
 */
async function chamarClaude<T extends z.ZodType>(schema: T, prompt: string, esforco: "low" | "medium" | "high"): Promise<z.infer<T>> {
  const resposta = await anthropic!.beta.messages.parse({
    model: MODELO_CLAUDE,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA,
    output_config: { effort: esforco, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (resposta.stop_reason === "refusal") {
    throw new Error("A IA recusou esta solicitação. Tente reformular o texto.");
  }
  if (resposta.parsed_output == null) {
    throw new Error("A IA respondeu num formato inesperado.");
  }
  return resposta.parsed_output as z.infer<T>;
}

function descreverErro(erro: unknown): string {
  if (erro instanceof OpenAI.AuthenticationError) return "Chave da OpenAI inválida.";
  if (erro instanceof OpenAI.RateLimitError) {
    return erro.code === "insufficient_quota"
      ? "A conta da OpenAI está sem créditos."
      : "Limite de uso da API da OpenAI atingido; tente de novo em instantes.";
  }
  if (erro instanceof OpenAI.NotFoundError) return `Modelo "${config.openaiModel}" não encontrado na OpenAI (confira OPENAI_MODEL).`;
  if (erro instanceof OpenAI.APIError) return `Erro da API da OpenAI (${erro.status}).`;
  if (erro instanceof Anthropic.AuthenticationError) return "Chave da Anthropic inválida.";
  if (erro instanceof Anthropic.RateLimitError) return "Limite de uso da API atingido; tente de novo em instantes.";
  if (erro instanceof Anthropic.APIError) return `Erro da API do Claude (${erro.status}).`;
  if (erro instanceof Error) return erro.message;
  return "Erro desconhecido ao chamar a IA.";
}

/**
 * Tenta o provedor de IA; se não houver chave ou a chamada falhar, usa a heurística local
 * e devolve um aviso — o sistema nunca trava por causa da IA.
 */
async function comFallback<T>(
  tipo: string,
  resumo: string,
  viaIA: () => Promise<T>,
  viaHeuristica: () => T,
): Promise<RespostaIA<T>> {
  if (provedor) {
    try {
      const resultado = await viaIA();
      registrarIA(tipo, provedor, resumo);
      return { modo: provedor, modelo: descricaoIA().modelo ?? undefined, resultado };
    } catch (erro) {
      console.error(`[ia:${tipo}]`, erro);
      registrarIA(tipo, "heuristica", resumo);
      return {
        modo: "heuristica",
        resultado: viaHeuristica(),
        aviso: `${descreverErro(erro)} Usei a heurística local no lugar.`,
      };
    }
  }
  registrarIA(tipo, "heuristica", resumo);
  return {
    modo: "heuristica",
    resultado: viaHeuristica(),
    aviso: "Nenhuma chave de IA configurada (OPENAI_API_KEY ou ANTHROPIC_API_KEY) — resultado gerado por regras simples.",
  };
}

// ---------------------------------------------------------------------------
// 1. Triagem da caixa de entrada (GTD + Eisenhower)
// ---------------------------------------------------------------------------

const TriagemSchema = z.object({
  itens: z.array(
    z.object({
      id: z.number().int(),
      titulo: z.string().describe("Próxima ação concreta, começando com verbo no infinitivo"),
      quadrante: z.number().int().describe("1, 2, 3 ou 4 conforme a matriz de Eisenhower"),
      estimativa: z.number().int().describe("Quantidade de pomodoros de 25 min (1 a 8)"),
      contexto: z.string().describe("Onde/como é feita: @computador, @telefone, @rua, @casa, @reunião"),
      projeto: z.string().describe("Área ou projeto: um cliente, Faculdade, Pessoal, Saúde..."),
      prazo: z.string().nullable().describe("Data limite YYYY-MM-DD se houver pista no texto, senão null"),
      justificativa: z.string().describe("Uma frase explicando o quadrante escolhido"),
    }),
  ),
});
export type Triagem = z.infer<typeof TriagemSchema>["itens"][number];

const PALAVRAS_URGENTE = /\b(hoje|urgente|agora|amanh[ãa]|asap|prazo|atrasad|cliente cobrando|bug em produ|fora do ar)\b/i;
const PALAVRAS_IMPORTANTE = /\b(cliente|entrega|faculdade|trabalho|prova|contrato|pagamento|sa[úu]de|m[ée]dico|deploy|projeto|estudar)\b/i;
const PALAVRAS_TELEFONE = /\b(ligar|telefonar|whats|zap|responder)\b/i;
const PALAVRAS_RUA = /\b(comprar|buscar|mercado|banco|farm[áa]cia|levar)\b/i;

function triagemHeuristica(tarefas: Tarefa[]): Triagem[] {
  return tarefas.map((t) => {
    const texto = `${t.title} ${t.notes}`;
    const urgente = PALAVRAS_URGENTE.test(texto);
    const importante = PALAVRAS_IMPORTANTE.test(texto);
    const quadrante = urgente && importante ? 1 : importante ? 2 : urgente ? 3 : 4;
    return {
      id: t.id,
      titulo: t.title,
      quadrante,
      estimativa: Math.min(8, Math.max(1, Math.ceil(texto.length / 60))),
      contexto: PALAVRAS_TELEFONE.test(texto) ? "@telefone" : PALAVRAS_RUA.test(texto) ? "@rua" : "@computador",
      projeto: t.project || "Geral",
      prazo: /\bhoje\b/i.test(texto) ? hoje() : /\bamanh[ãa]\b/i.test(texto) ? somarDias(hoje(), 1) : null,
      justificativa: "Classificado por palavras-chave (modo sem IA).",
    };
  });
}

export async function triarCaixaDeEntrada(tarefas: Tarefa[], projetosExistentes: string[]) {
  const lista = tarefas.map((t) => ({ id: t.id, texto: t.title, notas: t.notes || undefined }));
  const prompt = `Hoje é ${nomeDoDia(hoje())}, ${hoje()}.
Projetos/áreas que já existem no sistema (reutilize o nome quando fizer sentido): ${projetosExistentes.join(", ") || "nenhum ainda"}.

Processe cada item capturado na caixa de entrada abaixo como no GTD: reescreva como próxima ação, classifique na matriz de Eisenhower, estime pomodoros, defina contexto, projeto e prazo (só se o texto der pista; datas relativas como "sexta" devem virar YYYY-MM-DD).
Devolva um item para cada id recebido, mantendo o mesmo id.

${JSON.stringify(lista, null, 2)}`;

  return comFallback(
    "triagem",
    `${tarefas.length} item(ns) da caixa de entrada`,
    async () => {
      const { itens } = await chamarEstruturado(TriagemSchema, prompt, "low");
      return itens.map((i) => ({
        ...i,
        quadrante: Math.min(4, Math.max(1, i.quadrante)),
        estimativa: Math.min(8, Math.max(1, i.estimativa)),
      }));
    },
    () => triagemHeuristica(tarefas),
  );
}

// ---------------------------------------------------------------------------
// 2. Planejamento semanal
// ---------------------------------------------------------------------------

const PlanoSchema = z.object({
  resumo: z.string().describe("2 a 3 frases sobre a estratégia da semana"),
  alocacoes: z.array(
    z.object({
      task_id: z.number().int(),
      data: z.string().nullable().describe("YYYY-MM-DD dentro da semana, ou null se não couber"),
      motivo: z.string(),
    }),
  ),
  alertas: z.array(z.string()).describe("Sobrecarga, prazos em risco, dias sem pausa, tarefas que não couberam"),
  blocos_foco: z
    .array(z.object({ data: z.string(), periodo: z.string().describe("manhã ou tarde"), tema: z.string() }))
    .describe("Blocos de foco profundo sugeridos para tarefas do quadrante 2"),
});
export type Plano = z.infer<typeof PlanoSchema>;

export interface EntradaPlano {
  dias: string[];
  tarefas: Tarefa[];
  eventos: Evento[];
  capacidadeDiaria: number;
  energiaMedia: number | null;
  inicioExpediente: string;
  fimExpediente: string;
}

/** Horas de compromisso por dia, contando só o trecho dentro do expediente (aula à noite não tira foco do dia). */
function cargaDeReunioesPorDia(dias: string[], entrada: EntradaPlano): Record<string, number> {
  const carga: Record<string, number> = Object.fromEntries(dias.map((d) => [d, 0]));
  for (const e of entrada.eventos) {
    if (e.all_day) continue;
    const dia = dataLocal(new Date(e.start_at));
    if (!(dia in carga)) continue;
    const abre = new Date(`${dia}T${entrada.inicioExpediente}:00`).getTime();
    const fecha = new Date(`${dia}T${entrada.fimExpediente}:00`).getTime();
    const sobreposicao = Math.min(fecha, new Date(e.end_at).getTime()) - Math.max(abre, new Date(e.start_at).getTime());
    if (sobreposicao > 0) carga[dia] += sobreposicao / 3_600_000;
  }
  return carga;
}

function planoHeuristico(entrada: EntradaPlano): Plano {
  const uteis = entrada.dias.slice(0, 5).filter((d) => d >= hoje());
  if (!uteis.length) {
    return { resumo: "Não restam dias úteis nesta semana; planeje a próxima.", alocacoes: [], alertas: [], blocos_foco: [] };
  }
  const reunioes = cargaDeReunioesPorDia(uteis, entrada);
  // Cada hora de reunião consome ~2 pomodoros; 20% da capacidade fica de folga pra imprevistos.
  const livre: Record<string, number> = Object.fromEntries(
    uteis.map((d) => [d, Math.max(0, Math.floor(entrada.capacidadeDiaria * 0.8 - reunioes[d] * 2))]),
  );
  const ordenadas = [...entrada.tarefas].sort(
    (a, b) => (a.quadrant ?? 5) - (b.quadrant ?? 5) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  const alocacoes: Plano["alocacoes"] = [];
  const alertas: string[] = [];
  for (const t of ordenadas) {
    if (t.quadrant === 4) continue;
    const limite = t.due_date ?? uteis[uteis.length - 1];
    const dia = uteis.find((d) => d <= limite && livre[d] >= t.estimate) ?? uteis.find((d) => livre[d] >= t.estimate);
    if (!dia) {
      const maiorEspaco = Math.max(...Object.values(livre));
      alertas.push(
        t.estimate > maiorEspaco
          ? `"${t.title}" (${t.estimate} pomodoros) é maior que o espaço livre de qualquer dia — quebre em partes menores.`
          : `"${t.title}" não coube na semana.`,
      );
      continue;
    }
    livre[dia] -= t.estimate;
    alocacoes.push({ task_id: t.id, data: dia, motivo: `Quadrante ${t.quadrant ?? "?"}, primeiro dia com espaço.` });
    if (t.due_date && dia > t.due_date) alertas.push(`"${t.title}" ficou depois do prazo (${t.due_date}).`);
  }
  return {
    resumo: "Plano montado por regras: quadrante 1 primeiro, respeitando prazos, reuniões e 20% de folga diária.",
    alocacoes,
    alertas,
    blocos_foco: [],
  };
}

export async function planejarSemana(entrada: EntradaPlano) {
  const reunioes = cargaDeReunioesPorDia(entrada.dias, entrada);
  const prompt = `Monte o plano da semana ${entrada.dias[0]} a ${entrada.dias[6]} (hoje é ${hoje()}).

Capacidade: ${entrada.capacidadeDiaria} pomodoros de foco por dia útil, antes de descontar reuniões (cada hora de reunião consome cerca de 2 pomodoros). Deixe ~20% de folga por dia. Fim de semana só se for inevitável.
${entrada.energiaMedia != null ? `Energia média declarada nos check-ins recentes: ${entrada.energiaMedia.toFixed(1)}/5 — se estiver baixa, alivie a carga.` : ""}
Não aloque dias anteriores a hoje.

Horas de compromissos por dia: ${JSON.stringify(reunioes)}

Compromissos:
${JSON.stringify(
  entrada.eventos.map((e) => ({ titulo: e.title, inicio: e.start_at, fim: e.end_at, dia_inteiro: !!e.all_day })),
  null,
  2,
)}

Tarefas abertas (estimativa em pomodoros):
${JSON.stringify(
  entrada.tarefas.map((t) => ({
    id: t.id,
    titulo: t.title,
    quadrante: t.quadrant,
    estimativa: t.estimate,
    prazo: t.due_date,
    projeto: t.project,
    planejada_para: t.planned_date,
  })),
  null,
  2,
)}

Regras: quadrante 1 cedo na semana; quadrante 2 em blocos de foco protegidos (de preferência pela manhã); agrupe quadrante 3 num mesmo período; quadrante 4 só se sobrar espaço. Respeite prazos. Para tarefas que não couberem, use data null e explique nos alertas.`;

  return comFallback(
    "plano_semanal",
    `${entrada.tarefas.length} tarefa(s), ${entrada.eventos.length} compromisso(s)`,
    async () => {
      const plano = await chamarEstruturado(PlanoSchema, prompt, "medium");
      const validos = new Set(entrada.dias.filter((d) => d >= hoje()));
      plano.alocacoes = plano.alocacoes.filter((a) => a.data && validos.has(a.data));
      return plano;
    },
    () => planoHeuristico(entrada),
  );
}

// ---------------------------------------------------------------------------
// 3. Assistente de comunicação
// ---------------------------------------------------------------------------

export const TIPOS_MENSAGEM = {
  status: "Atualização de status para cliente ou gestor",
  assincrona: "Resposta assíncrona clara (Slack/WhatsApp/e-mail) que evita reunião",
  prazo: "Negociar prazo ou escopo sem queimar a relação",
  nao: "Dizer não (ou 'agora não') a uma demanda, com alternativa",
  ata: "Transformar anotações soltas de reunião em ata com decisões e responsáveis",
} as const;
export type TipoMensagem = keyof typeof TIPOS_MENSAGEM;

const MensagemSchema = z.object({
  assunto: z.string().describe("Linha de assunto curta, útil se for e-mail"),
  mensagem: z.string().describe("Texto final pronto pra enviar"),
  pontos_de_atencao: z.array(z.string()).describe("Até 3 observações: ambiguidades no rascunho, informação que falta confirmar"),
});
export type Mensagem = z.infer<typeof MensagemSchema>;

export async function redigirMensagem(tipo: TipoMensagem, rascunho: string, destinatario: string, tom: string) {
  const prompt = `Tipo de mensagem: ${TIPOS_MENSAGEM[tipo]}.
Destinatário: ${destinatario || "não informado"}.
Tom desejado: ${tom || "profissional e cordial"}.

Rascunho/anotações do usuário:
"""
${rascunho}
"""

Reescreva como uma mensagem pronta pra enviar. Regras de comunicação assíncrona: a informação principal na primeira frase; contexto mínimo; pedidos explícitos com data; listas quando houver mais de dois itens; nada de desculpas excessivas. Não invente fatos, datas ou números que não estejam no rascunho — se faltar algo, deixe um marcador [ASSIM] e cite em pontos_de_atencao.`;

  return comFallback(
    "comunicacao",
    TIPOS_MENSAGEM[tipo],
    () => chamarEstruturado(MensagemSchema, prompt, "low"),
    (): Mensagem => ({
      assunto: TIPOS_MENSAGEM[tipo],
      mensagem: `Olá${destinatario ? `, ${destinatario}` : ""}!\n\n${rascunho.trim()}\n\nFico à disposição.`,
      pontos_de_atencao: ["Modo sem IA: o texto foi apenas emoldurado, não reescrito."],
    }),
  );
}

// ---------------------------------------------------------------------------
// 4. Standup / resumo do dia
// ---------------------------------------------------------------------------

export interface EntradaStandup {
  concluidasOntem: Tarefa[];
  planejadasHoje: Tarefa[];
  pomodorosOntem: number;
  impedimentos: string;
}

const StandupSchema = z.object({ texto: z.string() });

export async function gerarStandup(e: EntradaStandup) {
  const heuristica = () => {
    const linhas = (ts: Tarefa[]) => (ts.length ? ts.map((t) => `• ${t.title}`).join("\n") : "• (nada registrado)");
    return {
      texto: `*Ontem* (${e.pomodorosOntem} pomodoros)\n${linhas(e.concluidasOntem)}\n\n*Hoje*\n${linhas(e.planejadasHoje)}\n\n*Impedimentos*\n${e.impedimentos.trim() || "Nenhum."}`,
    };
  };
  const prompt = `Escreva meu standup assíncrono (formato Slack, com *negrito*), em três seções: Ontem, Hoje, Impedimentos. Seja breve; agrupe tarefas do mesmo projeto numa linha. Não invente nada.

Concluído ontem (${e.pomodorosOntem} pomodoros de foco): ${JSON.stringify(e.concluidasOntem.map((t) => ({ titulo: t.title, projeto: t.project })))}
Planejado para hoje: ${JSON.stringify(e.planejadasHoje.map((t) => ({ titulo: t.title, projeto: t.project, quadrante: t.quadrant })))}
Impedimentos informados: ${e.impedimentos || "nenhum"}`;
  return comFallback("standup", "standup diário", () => chamarEstruturado(StandupSchema, prompt, "low"), heuristica);
}

// ---------------------------------------------------------------------------
// 5. Revisão semanal (GTD weekly review + bem-estar)
// ---------------------------------------------------------------------------

export interface EntradaRevisao {
  semana: string;
  concluidas: Tarefa[];
  pendentes: Tarefa[];
  pomodorosPorDia: Record<string, number>;
  interrompidos: number;
  minutosPorProjeto: Record<string, number>;
  porQuadrante: Record<string, number>;
  checkins: { date: string; energy: number; mood: number; sleep_hours: number | null; habits: string[] }[];
  habitos: string[];
  pomodorosForaDoHorario: number;
}

const RevisaoSchema = z.object({
  markdown: z
    .string()
    .describe(
      "Revisão em Markdown com as seções: ## Vitórias, ## Para onde foi o tempo, ## Energia e bem-estar, ## O que ajustar (3 ações), ## Compromisso da próxima semana",
    ),
});

export async function gerarRevisaoSemanal(e: EntradaRevisao) {
  const heuristica = () => {
    const totalPomodoros = Object.values(e.pomodorosPorDia).reduce((a, b) => a + b, 0);
    const energia = e.checkins.length ? e.checkins.reduce((a, c) => a + c.energy, 0) / e.checkins.length : null;
    const q2 = e.porQuadrante["2"] ?? 0;
    return {
      markdown: `## Vitórias
${e.concluidas.map((t) => `- ${t.title}`).join("\n") || "- Nenhuma tarefa concluída registrada."}

## Para onde foi o tempo
- ${totalPomodoros} pomodoros (${((totalPomodoros * 25) / 60).toFixed(1)} h de foco), ${e.interrompidos} interrompidos.
${Object.entries(e.minutosPorProjeto)
  .map(([p, m]) => `- ${p}: ${(m / 60).toFixed(1)} h`)
  .join("\n")}

## Energia e bem-estar
- Energia média: ${energia != null ? energia.toFixed(1) + "/5" : "sem check-ins"}.
- Pomodoros fora do horário: ${e.pomodorosForaDoHorario}.

## O que ajustar (3 ações)
- ${q2 < 3 ? "Reservar pelo menos 3 blocos para tarefas importantes e não urgentes (Q2)." : "Manter os blocos de Q2 protegidos."}
- Revisar as ${e.pendentes.length} pendências e eliminar o que for quadrante 4.
- ${e.pomodorosForaDoHorario > 0 ? "Encerrar o dia no horário combinado." : "Manter o limite de horário."}

## Compromisso da próxima semana
- Fazer o check-in diário e a triagem da caixa de entrada toda manhã.`,
    };
  };

  const prompt = `Faça a revisão semanal (estilo GTD) da semana que começa em ${e.semana}, a partir dos dados abaixo. Seja específico com números e nomes de tarefas; nada de conselhos genéricos. Em "Energia e bem-estar", relacione energia/humor/sono com o volume de trabalho e aponte sinais de sobrecarga com cuidado, sem tom clínico. As 3 ações de ajuste devem ser pequenas e verificáveis.

Hábitos acompanhados: ${e.habitos.join(", ")}
Concluídas: ${JSON.stringify(e.concluidas.map((t) => ({ titulo: t.title, projeto: t.project, quadrante: t.quadrant })))}
Pendentes: ${JSON.stringify(e.pendentes.map((t) => ({ titulo: t.title, quadrante: t.quadrant, prazo: t.due_date })))}
Pomodoros por dia: ${JSON.stringify(e.pomodorosPorDia)} (interrompidos: ${e.interrompidos}; fora do horário de trabalho: ${e.pomodorosForaDoHorario})
Minutos de foco por projeto: ${JSON.stringify(e.minutosPorProjeto)}
Tarefas concluídas por quadrante: ${JSON.stringify(e.porQuadrante)}
Check-ins diários: ${JSON.stringify(e.checkins)}`;

  return comFallback(
    "revisao_semanal",
    `semana de ${e.semana}`,
    () => chamarEstruturado(RevisaoSchema, prompt, "medium"),
    heuristica,
  );
}
