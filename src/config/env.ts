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
  mongodbUri: lerString("MONGODB_URI", "mongodb://localhost:27017/linkedin_posts"),
  apiKey: lerString("API_KEY"),
  port: lerNumero("PORT", 3333),
  scrapeIntervalHours: lerNumero("SCRAPE_INTERVAL_HOURS", 6),
  scrapeConcurrency: lerNumero("SCRAPE_CONCURRENCY", 1),
  sessionStoragePath: lerString("SESSION_STORAGE_PATH", "storage/session.json"),
  logLevel: lerString("LOG_LEVEL", "info"),
} as const;

export type Env = typeof env;
