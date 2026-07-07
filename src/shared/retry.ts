import { logger } from "./logger.js";

export interface RetryOptions {
  tentativas?: number;
  delayInicialMs?: number;
  fatorBackoff?: number;
  delayMaximoMs?: number;
  rotulo?: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa uma funcao com retry e backoff exponencial.
 * Reutilizavel por qualquer chamada suscetivel a falha transitoria (scraping, rede).
 */
export async function comBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    tentativas = 3,
    delayInicialMs = 1_000,
    fatorBackoff = 2,
    delayMaximoMs = 30_000,
    rotulo = "operacao",
  } = options;

  let ultimoErro: unknown;
  let delay = delayInicialMs;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) {
        logger.warn(
          { rotulo, tentativa, tentativas, delay },
          "Falha transitoria; aguardando antes de nova tentativa",
        );
        await sleep(delay);
        delay = Math.min(delay * fatorBackoff, delayMaximoMs);
      }
    }
  }

  logger.error({ rotulo, tentativas, erro: ultimoErro }, "Todas as tentativas falharam");
  throw ultimoErro;
}

/** Delay aleatorio para reduzir padrao de automacao (anti-bloqueio). */
export function delayAleatorio(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return sleep(ms);
}
