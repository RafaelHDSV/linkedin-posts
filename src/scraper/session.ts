import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Page } from "playwright";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { launchBrowser, createContext, sessaoExiste } from "./browser.js";

export type MotivoSessaoInvalida = "expirada" | "captcha" | "nao_autenticado";

export interface SessionStatus {
  valido: boolean;
  motivo?: MotivoSessaoInvalida;
  verificadoEm: string;
}

const FEED_URL = "https://www.linkedin.com/feed/";
const LOGIN_HINT = "/login";
const CHECKPOINT_HINT = "/checkpoint";

async function detectarEstado(page: Page): Promise<SessionStatus> {
  const verificadoEm = new Date().toISOString();
  const urlAtual = page.url();

  if (urlAtual.includes(CHECKPOINT_HINT)) {
    return { valido: false, motivo: "captcha", verificadoEm };
  }
  if (urlAtual.includes(LOGIN_HINT) || urlAtual.includes("/authwall")) {
    return { valido: false, motivo: "expirada", verificadoEm };
  }

  const temGlobalNav = await page
    .locator("#global-nav, .global-nav")
    .first()
    .isVisible()
    .catch(() => false);

  if (!temGlobalNav) {
    return { valido: false, motivo: "nao_autenticado", verificadoEm };
  }

  return { valido: true, verificadoEm };
}

/**
 * Verifica se a sessao persistida ainda esta autenticada no LinkedIn.
 * Nao tenta recuperar credenciais automaticamente: apenas informa o estado.
 */
export async function ensureValidSession(): Promise<SessionStatus> {
  const verificadoEm = new Date().toISOString();

  if (!sessaoExiste()) {
    logger.warn("Nenhuma sessao encontrada. Rode `yarn auth:login` para gerar uma.");
    return { valido: false, motivo: "nao_autenticado", verificadoEm };
  }

  const browser = await launchBrowser(true);
  try {
    const context = await createContext(browser, { comSessao: true });
    const page = await context.newPage();
    await page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const status = await detectarEstado(page);

    if (!status.valido) {
      logger.warn(
        { motivo: status.motivo },
        "Sessao do LinkedIn invalida. Rode `yarn auth:login` para renovar.",
      );
    }
    return status;
  } catch (erro) {
    logger.error({ erro }, "Erro ao validar a sessao do LinkedIn");
    return { valido: false, motivo: "nao_autenticado", verificadoEm };
  } finally {
    await browser.close();
  }
}

/**
 * Abre um navegador visivel para login manual e salva o storageState.
 * Executado por `yarn auth:login`.
 */
export async function loginInterativo(): Promise<void> {
  await mkdir(dirname(env.sessionStoragePath), { recursive: true });

  const browser = await launchBrowser(false);
  try {
    const context = await createContext(browser, { comSessao: false });
    const page = await context.newPage();

    logger.info("Abrindo o LinkedIn. Faca login manualmente (incluindo 2FA, se houver).");
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

    // Aguarda o usuario concluir o login (redirecionamento para o feed).
    await page.waitForURL((url) => url.href.includes("/feed"), { timeout: 300_000 });

    await context.storageState({ path: env.sessionStoragePath });
    logger.info({ arquivo: env.sessionStoragePath }, "Sessao salva com sucesso.");
  } finally {
    await browser.close();
  }
}
