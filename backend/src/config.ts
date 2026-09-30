import "dotenv/config";

function opcional(nome: string): string | undefined {
  const valor = process.env[nome]?.trim();
  return valor ? valor : undefined;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  timeZone: process.env.TZ ?? "America/Sao_Paulo",
  appPassword: opcional("APP_PASSWORD") ?? "orbita",
  sessionSecret: opcional("SESSION_SECRET") ?? "dev-secret-local-apenas",
  dbPath: opcional("DB_PATH") ?? "./data/orbita.db",
  /** "openai" ou "anthropic"; se vazio, usa o provedor cuja chave estiver definida (OpenAI primeiro). */
  aiProvider: opcional("AI_PROVIDER")?.toLowerCase(),
  openaiApiKey: opcional("OPENAI_API_KEY"),
  openaiModel: opcional("OPENAI_MODEL") ?? "gpt-5.4-mini",
  anthropicApiKey: opcional("ANTHROPIC_API_KEY"),
  googleIcsUrl: opcional("GOOGLE_CALENDAR_ICS_URL"),
  notionToken: opcional("NOTION_TOKEN"),
  notionParentPageId: opcional("NOTION_PARENT_PAGE_ID"),
  isProduction: process.env.NODE_ENV === "production",
};
