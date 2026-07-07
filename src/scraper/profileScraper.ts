import type { Page } from "playwright";
import { logger } from "../shared/logger.js";
import { delayAleatorio } from "../shared/retry.js";
import type { PostDTO } from "../shared/types.js";
import { launchBrowser, createContext } from "./browser.js";
import { ensureValidSession } from "./session.js";
import { parsearPostsDoHtml } from "./postParser.js";

export type ErroScraping =
  | "sessao_invalida"
  | "perfil_nao_encontrado"
  | "captcha_detectado"
  | "erro_desconhecido";

export interface ScrapeResult {
  username: string;
  posts: PostDTO[];
  erro?: ErroScraping;
}

const LIMITE_PADRAO = 10;

function urlAtividade(username: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(username)}/recent-activity/all/`;
}

async function scrollIncremental(page: Page, alvo: number): Promise<void> {
  let anterior = 0;
  for (let i = 0; i < 12; i++) {
    const total = await page.locator("[data-urn]").count().catch(() => 0);
    if (total >= alvo) break;
    if (total === anterior && i > 1) break;
    anterior = total;
    await page.mouse.wheel(0, 2_400);
    await delayAleatorio(800, 1_800);
  }
}

export async function scrapeProfile(username: string, limite = LIMITE_PADRAO): Promise<ScrapeResult> {
  const sessao = await ensureValidSession();
  if (!sessao.valido) {
    return {
      username,
      posts: [],
      erro: sessao.motivo === "captcha" ? "captcha_detectado" : "sessao_invalida",
    };
  }

  const browser = await launchBrowser(true);
  try {
    const context = await createContext(browser, { comSessao: true });
    const page = await context.newPage();

    const resposta = await page.goto(urlAtividade(username), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    if (resposta && resposta.status() === 404) {
      return { username, posts: [], erro: "perfil_nao_encontrado" };
    }

    const url = page.url();
    if (url.includes("/checkpoint")) {
      return { username, posts: [], erro: "captcha_detectado" };
    }
    if (url.includes("/login") || url.includes("/authwall")) {
      return { username, posts: [], erro: "sessao_invalida" };
    }

    await scrollIncremental(page, limite);
    const html = await page.content();
    const posts = parsearPostsDoHtml(html, username).slice(0, limite);

    if (posts.length === 0) {
      logger.warn(
        { username },
        "Nenhum post extraido. Possivel mudanca de layout, perfil sem posts ou bloqueio.",
      );
    } else {
      logger.info({ username, total: posts.length }, "Posts extraidos");
    }

    return { username, posts };
  } catch (erro) {
    logger.error({ username, erro }, "Erro ao coletar posts do perfil");
    return { username, posts: [], erro: "erro_desconhecido" };
  } finally {
    await browser.close();
  }
}
