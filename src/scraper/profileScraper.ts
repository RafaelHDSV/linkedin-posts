import type { BrowserContext, Page } from "playwright-core";
import { logger } from "../shared/logger.js";
import { delayAleatorio } from "../shared/retry.js";
import type { PostDTO } from "../shared/types.js";
import { launchBrowser, createContext } from "./browser.js";
import { ensureValidSession } from "./session.js";
import { limparTexto, parsearPostsDoHtml } from "./postParser.js";
import { ehUrlPostUtilizavel } from "./urlPost.js";

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

function deduplicarPorTexto(posts: PostDTO[]): PostDTO[] {
  const vistos = new Map<string, PostDTO>();
  for (const post of posts) {
    const chave = post.texto.slice(0, 120).toLowerCase();
    const atual = vistos.get(chave);
    if (!atual) {
      vistos.set(chave, post);
      continue;
    }
    const preferirNovo =
      (post.url.includes("/feed/update/") && !atual.url.includes("/feed/update/")) ||
      (post.postId.startsWith("urn:li:activity:") && atual.postId.startsWith("sdui:"));
    if (preferirNovo) vistos.set(chave, post);
  }
  return [...vistos.values()].sort(
    (a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime(),
  );
}

function urlAtividade(username: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(username)}/recent-activity/all/`;
}

async function scrollIncremental(page: Page, alvo: number): Promise<void> {
  let anterior = 0;
  for (let i = 0; i < 12; i++) {
    const totalLegacy = await page.locator("[data-urn]").count().catch(() => 0);
    const totalSdui = await page.locator('[role="listitem"]').count().catch(() => 0);
    const total = Math.max(totalLegacy, totalSdui);
    if (total >= alvo) break;
    if (total === anterior && i > 1) break;
    anterior = total;
    await page.mouse.wheel(0, 2_400);
    await delayAleatorio(800, 1_800);
  }
}

/** Documentos do LinkedIn carregam preview via iframe/canvas apos scroll. */
async function aguardarMidiasLazy(page: Page): Promise<void> {
  const documentos = page.locator(".document-s-container");
  const total = await documentos.count().catch(() => 0);

  for (let i = 0; i < total; i++) {
    const container = documentos.nth(i);
    await container.scrollIntoViewIfNeeded().catch(() => undefined);
    await delayAleatorio(1_500, 2_500);
    await container
      .locator("img, canvas, .ssplayer-document__page")
      .first()
      .waitFor({ state: "attached", timeout: 8_000 })
      .catch(() => undefined);
  }

  const videos = page.locator(".media-player__player, .update-components-linkedin-video");
  const totalVideos = await videos.count().catch(() => 0);
  for (let i = 0; i < Math.min(totalVideos, 6); i++) {
    await videos.nth(i).scrollIntoViewIfNeeded().catch(() => undefined);
    await delayAleatorio(400, 900);
  }

  await page.waitForTimeout(1_500);
}

type LinkedInClipboardHook = {
  __linkedinCopyHook?: boolean;
  __linkedinCopied?: string;
};

/** Instala hooks para capturar o texto copiado quando a Clipboard API falha (headless). */
async function instalarCapturaClipboard(page: Page): Promise<void> {
  // Callback roda no browser; tipagem DOM nao esta no tsconfig do Node.
  await page.evaluate(() => {
    const w = globalThis as typeof globalThis & LinkedInClipboardHook;
    if (w.__linkedinCopyHook) return;
    w.__linkedinCopyHook = true;
    w.__linkedinCopied = "";

    const doc = (globalThis as { document?: { addEventListener: Function } }).document;
    doc?.addEventListener("copy", (evento: { clipboardData?: { getData: (f: string) => string } }) => {
      try {
        const texto = evento.clipboardData?.getData("text") ?? "";
        if (texto) w.__linkedinCopied = texto;
      } catch {
        /* ignore */
      }
    });

    const nav = globalThis as typeof globalThis & {
      navigator?: {
        clipboard?: {
          writeText: (texto: string) => Promise<void>;
        };
      };
    };
    const clipboard = nav.navigator?.clipboard;
    if (clipboard?.writeText) {
      const original = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async (texto: string) => {
        w.__linkedinCopied = texto;
        return original(texto);
      };
    }
  });
}

async function limparCapturaClipboard(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const w = globalThis as typeof globalThis & LinkedInClipboardHook;
      w.__linkedinCopied = "";
    })
    .catch(() => undefined);
}

async function lerLinkCopiado(page: Page): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const viaApi = await page
      .evaluate(async () => {
        try {
          const nav = globalThis as typeof globalThis & {
            navigator?: { clipboard?: { readText: () => Promise<string> } };
          };
          return (await nav.navigator?.clipboard?.readText()) ?? "";
        } catch {
          return "";
        }
      })
      .catch(() => "");
    if (viaApi.trim()) return viaApi.trim();

    const viaHook = await page
      .evaluate(() => {
        const w = globalThis as typeof globalThis & LinkedInClipboardHook;
        return (w.__linkedinCopied ?? "").trim();
      })
      .catch(() => "");
    if (viaHook) return viaHook;

    await delayAleatorio(100, 180);
  }
  return "";
}

async function copiarLinkPublicacao(
  page: Page,
  context: BrowserContext,
  itemIndex: number,
): Promise<string | null> {
  const item = page.locator('[role="listitem"]').nth(itemIndex);
  await item.scrollIntoViewIfNeeded().catch(() => undefined);

  const menu = item
    .locator(
      'button[aria-label*="menu de controle da publica"], button[aria-label*="Open control menu"], button[aria-label*="control menu"]',
    )
    .first();
  if ((await menu.count()) === 0) return null;

  await context
    .grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://www.linkedin.com",
    })
    .catch(() => undefined);
  await instalarCapturaClipboard(page);
  await limparCapturaClipboard(page);

  await menu.click({ timeout: 5_000 }).catch(() => undefined);
  await delayAleatorio(500, 900);

  const copy = page
    .getByRole("button", { name: /copiar link|copy link/i })
    .or(page.getByText(/copiar link( da publica[cç][aã]o)?/i))
    .or(page.getByText(/copy link( to post)?/i))
    .first();
  if (!(await copy.isVisible().catch(() => false))) {
    await page.keyboard.press("Escape").catch(() => undefined);
    return null;
  }

  await copy.click();
  await delayAleatorio(400, 800);
  const link = await lerLinkCopiado(page);
  await page.keyboard.press("Escape").catch(() => undefined);
  await delayAleatorio(200, 400);

  if (!link) return null;
  if (!ehUrlPostUtilizavel(link)) {
    logger.debug({ link: link.slice(0, 120) }, "Clipboard retornou URL nao utilizavel");
    return null;
  }
  return link.trim();
}

/**
 * Cards SDUI frequentemente nao expoem /feed/update/ no HTML.
 * Resolve a URL via "Copiar link da publicação" na ordem visual dos listitems do autor.
 */
async function enriquecerUrlsSdui(
  page: Page,
  context: BrowserContext,
  username: string,
  posts: PostDTO[],
): Promise<PostDTO[]> {
  const pendentes = posts.filter((p) => !ehUrlPostUtilizavel(p.url));
  if (pendentes.length === 0) return posts;

  await context
    .grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://www.linkedin.com",
    })
    .catch(() => undefined);
  await instalarCapturaClipboard(page);

  const perfilHref = `/in/${username.toLowerCase()}`;
  const items = page.locator('[role="listitem"]');
  const total = await items.count();

  for (let i = 0; i < total; i++) {
    if (pendentes.every((p) => p.url)) break;

    const item = items.nth(i);
    const html = (await item.innerHTML().catch(() => "")) || "";
    if (!html.toLowerCase().includes(perfilHref)) continue;
    if (!/menu de controle da publica/i.test(html)) continue;

    const textoBruto =
      (await item.locator("[data-testid='expandable-text-box']").textContent().catch(() => "")) ||
      "";
    const texto = limparTexto(textoBruto).slice(0, 60);
    const post = pendentes.find(
      (p) =>
        !ehUrlPostUtilizavel(p.url) &&
        (p.texto.startsWith(texto.slice(0, 40)) || texto.startsWith(p.texto.slice(0, 40))),
    );
    if (!post) continue;

    const link = await copiarLinkPublicacao(page, context, i);
    if (link) {
      post.url = link;
      logger.debug({ postId: post.postId, link }, "URL resolvida via copiar link");
    } else {
      logger.warn(
        { postId: post.postId, itemIndex: i },
        "Copiar link nao resolveu URL para card SDUI",
      );
    }
  }

  const aindaSemUrl = posts.filter((p) => !ehUrlPostUtilizavel(p.url)).length;
  if (aindaSemUrl > 0) {
    logger.warn(
      { username, aindaSemUrl, total: posts.length },
      "Cards SDUI sem URL utilizavel apos enriquecimento - serao descartados",
    );
  }

  return posts;
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

  const browser = await launchBrowser();
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
    await aguardarMidiasLazy(page);
    const html = await page.content();
    let posts = parsearPostsDoHtml(html, username).slice(0, limite);
    posts = await enriquecerUrlsSdui(page, context, username, posts);

    // Descarta cards sem URL utilizavel apos enriquecimento (exige link real).
    posts = posts.filter((p) => ehUrlPostUtilizavel(p.url));
    // Layout misto gera o mesmo post com urn legado e sdui:{opaque}; prefere URL canonica.
    posts = deduplicarPorTexto(posts).slice(0, limite);

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
