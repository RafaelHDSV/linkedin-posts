import "dotenv/config";

export type SessionStorageProvider = "local" | "supabase";

function lerString(nome: string, padrao?: string): string {
  const valor = process.env[nome] ?? padrao;
  if (valor === undefined || valor === "") {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  }
  return valor;
}

function lerStringOpcional(nome: string, padrao?: string): string | undefined {
  const valor = process.env[nome] ?? padrao;
  return valor === "" ? undefined : valor;
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

const isVercel = process.env.VERCEL === "1";

function resolverSessionProvider(): SessionStorageProvider {
  const bruto = process.env.SESSION_STORAGE_PROVIDER;
  if (bruto === "local" || bruto === "supabase") return bruto;
  return isVercel ? "supabase" : "local";
}

const sessionStorageProvider = resolverSessionProvider();

export const env = {
  isVercel,
  isServerless: isVercel || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME),
  supabaseUrl: lerString("SUPABASE_URL"),
  supabaseServiceRoleKey: lerString("SUPABASE_SERVICE_ROLE_KEY"),
  apiKey: lerString("API_KEY"),
  cronSecret: lerStringOpcional("CRON_SECRET"),
  port: lerNumero("PORT", 3333),
  scrapeIntervalHours: lerNumero("SCRAPE_INTERVAL_HOURS", 6),
  scrapeConcurrency: lerNumero("SCRAPE_CONCURRENCY", 1),
  /** Caminho local do arquivo de sessao (dev / auth:login). */
  sessionLocalPath: lerString("SESSION_LOCAL_PATH", "storage/session.json"),
  sessionStorageProvider,
  /** Bucket Supabase Storage (quando provider = supabase). */
  sessionStorageBucket: lerStringOpcional(
    "SESSION_STORAGE_BUCKET",
    sessionStorageProvider === "supabase" ? "linkedin-posts-private" : undefined,
  ),
  /** Chave do objeto no bucket (quando provider = supabase). */
  sessionRemotePath: lerString("SESSION_REMOTE_PATH", "session/session.json"),
  scrapeHeadless: process.env.SCRAPE_HEADLESS !== "false",
  logLevel: lerString("LOG_LEVEL", "info"),
} as const;

export type Env = typeof env;

/** Valida variaveis obrigatorias para coleta na Vercel. */
export function validarAmbienteColeta(): void {
  if (env.sessionStorageProvider === "supabase" && !env.sessionStorageBucket) {
    throw new Error("SESSION_STORAGE_BUCKET obrigatorio quando SESSION_STORAGE_PROVIDER=supabase");
  }
  if (env.isVercel && !env.cronSecret) {
    throw new Error("CRON_SECRET obrigatorio na Vercel");
  }
}
