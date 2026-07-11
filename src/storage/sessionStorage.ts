import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { env } from "../config/env.js";
import { getSupabase } from "../db/supabase.js";
import { logger } from "../shared/logger.js";

const ARQUIVO_TEMP = join(tmpdir(), "linkedin-posts-session.json");

function parsearStorageState(bruto: string): { cookies?: Array<{ name: string; value?: string }> } {
  return JSON.parse(bruto) as { cookies?: Array<{ name: string; value?: string }> };
}

export function sessaoTemCookieAuthNoConteudo(bruto: string): boolean {
  try {
    const estado = parsearStorageState(bruto);
    return (
      estado.cookies?.some((cookie) => cookie.name === "li_at" && Boolean(cookie.value)) ?? false
    );
  } catch {
    return false;
  }
}

async function baixarDoSupabase(): Promise<string | null> {
  const bucket = env.sessionStorageBucket;
  if (!bucket) return null;

  const { data, error } = await getSupabase()
    .storage.from(bucket)
    .download(env.sessionRemotePath);

  if (error) {
    logger.warn({ erro: error.message, bucket, path: env.sessionRemotePath }, "Sessao nao encontrada no Supabase Storage");
    return null;
  }

  return await data.text();
}

function lerArquivoLocal(): string | null {
  if (!existsSync(env.sessionLocalPath)) return null;
  return readFileSync(env.sessionLocalPath, "utf8");
}

/** Le o JSON da sessao (local ou Supabase Storage). */
export async function lerConteudoSessao(): Promise<string | null> {
  if (env.sessionStorageProvider === "supabase") {
    return baixarDoSupabase();
  }
  return lerArquivoLocal();
}

export async function sessaoDisponivel(): Promise<boolean> {
  const conteudo = await lerConteudoSessao();
  return Boolean(conteudo);
}

export async function sessaoTemCookieAuth(): Promise<boolean> {
  const conteudo = await lerConteudoSessao();
  if (!conteudo) return false;
  return sessaoTemCookieAuthNoConteudo(conteudo);
}

/**
 * Materializa a sessao em um caminho de arquivo para o Playwright (storageState).
 * Em serverless usa /tmp; em local reutiliza o arquivo do disco quando possivel.
 */
export async function prepararArquivoSessao(): Promise<string | null> {
  if (env.sessionStorageProvider === "local" && existsSync(env.sessionLocalPath)) {
    return env.sessionLocalPath;
  }

  const conteudo = await lerConteudoSessao();
  if (!conteudo) return null;

  mkdirSync(dirname(ARQUIVO_TEMP), { recursive: true });
  writeFileSync(ARQUIVO_TEMP, conteudo, "utf8");
  return ARQUIVO_TEMP;
}

/** Envia o JSON da sessao local para o Supabase Storage (pos auth:login). */
export async function enviarSessaoParaNuvem(conteudo?: string): Promise<void> {
  const bucket = env.sessionStorageBucket;
  if (!bucket) {
    throw new Error("SESSION_STORAGE_BUCKET nao configurado");
  }

  const bruto = conteudo ?? lerArquivoLocal();
  if (!bruto) {
    throw new Error(
      `Arquivo local inexistente: ${env.sessionLocalPath}. Rode yarn auth:login antes.`,
    );
  }

  if (!sessaoTemCookieAuthNoConteudo(bruto)) {
    throw new Error("Sessao local sem cookie li_at. Conclua o login ate o feed.");
  }

  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(env.sessionRemotePath, bruto, {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw error;

  logger.info(
    { bucket, path: env.sessionRemotePath },
    "Sessao enviada para o Supabase Storage",
  );
}
