import { existsSync, readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { env } from "../config/env.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CHROMIUM_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--no-sandbox",
];

export interface LaunchOptions {
  headless?: boolean;
  comSessao?: boolean;
}

export async function launchBrowser(headless = env.scrapeHeadless): Promise<Browser> {
  return chromium.launch({
    headless,
    args: CHROMIUM_ARGS,
  });
}

export function sessaoExiste(): boolean {
  return existsSync(env.sessionStoragePath);
}

/** Verifica se o storageState salvo contem o cookie de sessao autenticada (li_at). */
export function sessaoTemCookieAuth(): boolean {
  if (!sessaoExiste()) return false;
  try {
    const bruto = readFileSync(env.sessionStoragePath, "utf8");
    const estado = JSON.parse(bruto) as { cookies?: Array<{ name: string; value?: string }> };
    return (
      estado.cookies?.some((cookie) => cookie.name === "li_at" && Boolean(cookie.value)) ??
      false
    );
  } catch {
    return false;
  }
}

async function aplicarEvasaoBasica(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });
}

export async function createContext(
  browser: Browser,
  options: { comSessao?: boolean } = {},
): Promise<BrowserContext> {
  const { comSessao = true } = options;
  const usarSessao = comSessao && sessaoExiste();

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    storageState: usarSessao ? env.sessionStoragePath : undefined,
  });

  await aplicarEvasaoBasica(context);
  return context;
}
