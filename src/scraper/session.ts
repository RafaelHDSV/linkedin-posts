import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { BrowserContext, Page } from "playwright-core";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { launchBrowser, createContext } from "./browser.js";
import { sessaoDisponivel, sessaoTemCookieAuth } from "../storage/sessionStorage.js";

export type MotivoSessaoInvalida = "expirada" | "captcha" | "nao_autenticado";

export interface SessionStatus {
  valido: boolean;
  motivo?: MotivoSessaoInvalida;
  verificadoEm: string;
}

const FEED_URL = "https://www.linkedin.com/feed/";
const LOGIN_HINT = "/login";
const CHECKPOINT_HINT = "/checkpoint";

const SELETORES_NAV =
  "#global-nav, .global-nav, header.global-nav, nav.global-nav, [data-test-global-nav]";

function urlIndicaLogin(url: string): boolean {
  return url.includes(LOGIN_HINT) || url.includes("/authwall");
}

async function contextoTemLiAt(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies("https://www.linkedin.com");
  return cookies.some((cookie) => cookie.name === "li_at" && cookie.value.length > 0);
}

async function aguardarEstabilizacao(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);

  await Promise.race([
    page.waitForURL(
      (url) =>
        url.href.includes("/feed") ||
        url.href.includes(LOGIN_HINT) ||
        url.href.includes(CHECKPOINT_HINT) ||
        url.href.includes("/authwall"),
      { timeout: 20_000 },
    ),
    page.waitForSelector(SELETORES_NAV, { timeout: 20_000 }),
  ]).catch(() => undefined);

  await page.waitForTimeout(2_000);
}

async function detectarEstado(page: Page, context: BrowserContext): Promise<SessionStatus> {
  const verificadoEm = new Date().toISOString();
  const urlAtual = page.url();

  if (urlAtual.includes(CHECKPOINT_HINT)) {
    return { valido: false, motivo: "captcha", verificadoEm };
  }
  if (urlIndicaLogin(urlAtual)) {
    return { valido: false, motivo: "expirada", verificadoEm };
  }

  const temGlobalNav = await page
    .locator(SELETORES_NAV)
    .first()
    .isVisible()
    .catch(() => false);

  if (temGlobalNav) {
    return { valido: true, verificadoEm };
  }

  const temLiAt = await contextoTemLiAt(context);
  if (temLiAt && urlAtual.includes("linkedin.com") && !urlIndicaLogin(urlAtual)) {
    logger.debug(
      { url: urlAtual },
      "Nav nao detectada, mas cookie li_at presente — sessao considerada valida",
    );
    return { valido: true, verificadoEm };
  }

  logger.debug({ url: urlAtual, temLiAt }, "Sessao nao autenticada apos carregar o feed");
  return { valido: false, motivo: "nao_autenticado", verificadoEm };
}

/**
 * Verifica se a sessao persistida ainda esta autenticada no LinkedIn.
 * Nao tenta recuperar credenciais automaticamente: apenas informa o estado.
 */
export async function ensureValidSession(): Promise<SessionStatus> {
  const verificadoEm = new Date().toISOString();

  if (!(await sessaoDisponivel())) {
    logger.warn(
      env.sessionStorageProvider === "supabase"
        ? "Nenhuma sessao no Supabase Storage. Rode yarn auth:login e yarn session:upload."
        : "Nenhuma sessao encontrada. Rode yarn auth:login para gerar uma.",
    );
    return { valido: false, motivo: "nao_autenticado", verificadoEm };
  }

  if (!(await sessaoTemCookieAuth())) {
    logger.warn(
      "Sessao sem cookie li_at. Rode yarn auth:login e conclua o login ate o feed.",
    );
    return { valido: false, motivo: "nao_autenticado", verificadoEm };
  }

  const browser = await launchBrowser();
  try {
    const context = await createContext(browser, { comSessao: true });
    const page = await context.newPage();
    await page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await aguardarEstabilizacao(page);
    const status = await detectarEstado(page, context);

    if (!status.valido) {
      logger.warn(
        { motivo: status.motivo, url: page.url() },
        "Sessao do LinkedIn invalida. Rode yarn auth:login para renovar.",
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
 * Executado por `yarn auth:login` (somente ambiente local).
 */
export async function loginInterativo(): Promise<void> {
  if (env.isServerless) {
    throw new Error("auth:login nao pode rodar em ambiente serverless. Use sua maquina local.");
  }

  await mkdir(dirname(env.sessionLocalPath), { recursive: true });

  const browser = await launchBrowser(false);
  try {
    const context = await createContext(browser, { comSessao: false });
    const page = await context.newPage();

    logger.info("Abrindo o LinkedIn. Faca login manualmente (incluindo 2FA, se houver).");
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

    await page.waitForURL((url) => url.href.includes("/feed"), { timeout: 300_000 });

    await context.storageState({ path: env.sessionLocalPath });
    logger.info({ arquivo: env.sessionLocalPath }, "Sessao salva com sucesso.");
  } finally {
    await browser.close();
  }
}
