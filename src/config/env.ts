import "dotenv/config";

function lerString(nome: string, padrao?: string): string {
  const valor = process.env[nome] ?? padrao;
  if (valor === undefined || valor === "") {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function lerNumero(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === "") {
    return padrao;
  }
  const numero = Number(bruto);
  if (Number.isNaN(numero)) {
    throw new Error(`Variavel de ambiente ${nome} deve ser numerica, recebido: ${bruto}`);
  }
  return numero;
}

export const env = {
  supabaseUrl: lerString("SUPABASE_URL"),
  supabaseServiceRoleKey: lerString("SUPABASE_SERVICE_ROLE_KEY"),
  apiKey: lerString("API_KEY"),
  port: lerNumero("PORT", 3333),
  scrapeIntervalHours: lerNumero("SCRAPE_INTERVAL_HOURS", 6),
  scrapeConcurrency: lerNumero("SCRAPE_CONCURRENCY", 1),
  sessionStoragePath: lerString("SESSION_STORAGE_PATH", "storage/session.json"),
  /** false = navegador visivel nas coletas (util se o LinkedIn bloquear headless). */
  scrapeHeadless: process.env.SCRAPE_HEADLESS !== "false",
  logLevel: lerString("LOG_LEVEL", "info"),
} as const;

export type Env = typeof env;
