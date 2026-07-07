import { existsSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { env } from "../config/env.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface LaunchOptions {
  headless?: boolean;
  comSessao?: boolean;
}

export async function launchBrowser(headless = true): Promise<Browser> {
  return chromium.launch({ headless });
}

export function sessaoExiste(): boolean {
  return existsSync(env.sessionStoragePath);
}

export async function createContext(
  browser: Browser,
  options: { comSessao?: boolean } = {},
): Promise<BrowserContext> {
  const { comSessao = true } = options;
  const usarSessao = comSessao && sessaoExiste();

  return browser.newContext({
    userAgent: USER_AGENT,
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    storageState: usarSessao ? env.sessionStoragePath : undefined,
  });
}
