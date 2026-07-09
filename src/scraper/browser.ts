import type { Browser, BrowserContext } from "playwright-core";
import { env } from "../config/env.js";
import {
  prepararArquivoSessao,
  sessaoDisponivel,
  sessaoTemCookieAuth,
} from "../storage/sessionStorage.js";

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

async function chromiumLocal(headless: boolean) {
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless,
    args: CHROMIUM_ARGS,
  });
}

async function chromiumServerless() {
  const [{ chromium }, chromiumPkg] = await Promise.all([
    import("playwright-core"),
    import("@sparticuz/chromium"),
  ]);

  return chromium.launch({
    args: [...chromiumPkg.default.args, ...CHROMIUM_ARGS],
    executablePath: await chromiumPkg.default.executablePath(),
    headless: true,
  });
}

export async function launchBrowser(headless = env.scrapeHeadless): Promise<Browser> {
  if (env.isServerless) {
    return chromiumServerless();
  }
  return chromiumLocal(headless);
}

export async function sessaoExiste(): Promise<boolean> {
  return sessaoDisponivel();
}

export { sessaoTemCookieAuth };

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
  const caminhoSessao = comSessao ? await prepararArquivoSessao() : null;

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    storageState: caminhoSessao ?? undefined,
  });

  await aplicarEvasaoBasica(context);
  return context;
}
