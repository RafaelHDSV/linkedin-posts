import { parseHTML } from "linkedom";
import type { PostDTO, TipoMidia } from "../shared/types.js";

export interface RawPost {
  urn: string | null;
  postId?: string | null;
  url?: string | null;
  publicadoEmTexto?: string | null;
  agora?: Date;
  texto: string;
  midiaImagens: number;
  midiaVideos: number;
  midiaDocumentos: number;
  midiaUrls: string[];
  reacoesTexto: string | null;
}

export interface ParseOptions {
  agora?: Date;
}

const ACTIVITY_BASE_URL = "https://www.linkedin.com/feed/update/";
/** LinkedIn epoch minimo para IDs validos (2010-01-01). */
const EPOCH_MS_MINIMO = 1_262_304_000_000;
/** Snowflake classico fica tipicamente abaixo deste teto (~ano 2030). */
const SNOWFLAKE_MS_MAXIMO = Date.parse("2035-01-01T00:00:00.000Z");

/**
 * Interface estrutural minima dos nos retornados pelo linkedom.
 * Evita depender da lib DOM do TypeScript (nao habilitada no tsconfig).
 */
interface ParsedElement {
  getAttribute(nome: string): string | null;
  textContent: string | null;
  innerHTML?: string;
  outerHTML?: string;
  querySelector(seletor: string): ParsedElement | null;
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

interface ParsedDocument {
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

const SELETORES_TEXTO =
  "[data-testid='expandable-text-box'], .update-components-text, .feed-shared-update-v2__description, .feed-shared-text, .feed-shared-inline-show-more-text";

const SELETORES_IMAGEM =
  ".update-components-image, .feed-shared-image, .update-components-article__image, .feed-shared-external-video__image";

const SELETORES_VIDEO =
  "video, .update-components-linkedin-video, .feed-shared-external-video, [data-test-article-video], .update-components-linkedin-native-video, .vjs-poster, .vjs-poster-background, .media-player__player";

const SELETORES_DOCUMENTO =
  ".update-components-document, .document-s-container, .ssplayer-document, .update-components-document__container";

const ATRIBUTOS_MIDIA = ["src", "data-delayed-url", "data-ghost-url", "data-src", "poster"] as const;

const MESES_PT: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/** Converte "1.234", "1,2 mil", "1.2K", "2M" em numero aproximado. */
export function parsearReacoes(texto: string | null | undefined): number | undefined {
  if (!texto) return undefined;
  const limpo = texto.trim().toLowerCase().replace(/\s+/g, " ");
  const match = limpo.match(/([\d.,]+)\s*(mil|mi|m|k)?/i);
  if (!match) return undefined;

  const numeroBruto = match[1];
  const sufixo = match[2];
  if (!numeroBruto) return undefined;

  const normalizado = sufixo
    ? numeroBruto.replace(/\./g, "").replace(",", ".")
    : numeroBruto.replace(/[.,]/g, "");

  let valor = Number(normalizado);
  if (Number.isNaN(valor)) return undefined;

  if (sufixo === "k" || sufixo === "mil") valor *= 1_000;
  else if (sufixo === "m" || sufixo === "mi") valor *= 1_000_000;

  return Math.round(valor);
}

/** Extrai o ID numerico de urn:li:activity:NNNN. */
export function extrairActivityId(urn: string): string | null {
  const match = urn.match(/urn:li:activity:(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Decodifica timestamp do Snowflake ID do LinkedIn (41 bits superiores, ms Unix).
 * Referencia: bit shift >> 22 sobre o ID de 19 digitos.
 */
export function parsearDataDoUrn(urn: string): string {
  const id = extrairActivityId(urn);
  if (!id) return "";

  try {
    const ms = Number(BigInt(id) >> 22n);
    if (ms < EPOCH_MS_MINIMO || ms > SNOWFLAKE_MS_MAXIMO) return "";
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}

/**
 * Converte datas curtas do feed PT-BR ("15 de out.") em ISO (meio-dia UTC).
 * Usa o ano da referencia; se a data cair no futuro, volta um ano.
 */
export function parsearDataPtBr(
  texto: string | null | undefined,
  agora: Date = new Date(),
): string {
  if (!texto) return "";
  const match = texto
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+de\s+([a-zç]{3})\.?$/i);
  if (!match) return "";

  const dia = Number(match[1]);
  const mesKey = (match[2] ?? "").slice(0, 3).normalize("NFD").replace(/\p{M}/gu, "");
  const mes = MESES_PT[mesKey];
  if (!Number.isInteger(dia) || dia < 1 || dia > 31 || mes === undefined) return "";

  let ano = agora.getUTCFullYear();
  let candidato = new Date(Date.UTC(ano, mes, dia, 12, 0, 0));
  if (candidato.getTime() > agora.getTime() + 24 * 60 * 60 * 1000) {
    ano -= 1;
    candidato = new Date(Date.UTC(ano, mes, dia, 12, 0, 0));
  }
  return candidato.toISOString();
}

export function limparTexto(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/\s*…mais\s*$/i, "")
    .replace(/\s*\.\.\.\s*mais\s*$/i, "")
    .replace(/\s*hashtag#/gi, " #")
    .trim();
}

function ehUrlMidiaValida(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.includes("static.licdn.com")) return false;
  if (url.includes("profile-displayphoto")) return false;
  if (url.includes("ghost-person")) return false;
  if (url.includes("/embeds/native-document.html")) return false;
  return (
    url.includes("media.licdn.com") ||
    url.includes("licdn.com/dms/image") ||
    url.includes("dms.licdn.com/playlist") ||
    url.endsWith(".mp4") ||
    url.includes("/video/")
  );
}

function urlsDeBackground(style: string | null): string[] {
  if (!style) return [];
  const match = style.match(/url\(["']?([^"')]+)["']?\)/i);
  return match?.[1] && ehUrlMidiaValida(match[1]) ? [match[1]] : [];
}

function decodificarEntidadesHtml(url: string): string {
  return url.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/** Busca URLs de midia embutidas no HTML bruto do container (background-image, poster, etc.). */
export function extrairMidiaUrlsDoHtmlBruto(htmlInterno: string): string[] {
  const urls = new Set<string>();
  const padroes = [
    /https:\/\/media\.licdn\.com\/[^"'\s)<>\\]+/g,
    /https:\/\/dms\.licdn\.com\/playlist\/[^"'\s)<>\\]+/g,
  ];

  for (const padrao of padroes) {
    for (const match of htmlInterno.matchAll(padrao)) {
      const url = decodificarEntidadesHtml(match[0]);
      if (ehUrlMidiaValida(url)) urls.add(url);
    }
  }

  return [...urls];
}

export function extrairMidiaUrls(el: ParsedElement): string[] {
  const urls = new Set<string>();
  const htmlInterno = el.innerHTML ?? "";

  for (const url of extrairMidiaUrlsDoHtmlBruto(htmlInterno)) {
    urls.add(url);
  }

  const candidatos = [
    ...Array.from(el.querySelectorAll(`${SELETORES_IMAGEM} img, ${SELETORES_VIDEO} img`)),
    ...Array.from(el.querySelectorAll(`${SELETORES_DOCUMENTO} img`)),
    ...Array.from(el.querySelectorAll("video")),
    ...Array.from(el.querySelectorAll("video source")),
    ...Array.from(el.querySelectorAll(".vjs-poster, .vjs-poster-background")),
    ...Array.from(el.querySelectorAll("img[src*='media.licdn.com']")),
  ];

  for (const node of candidatos) {
    for (const attr of ATRIBUTOS_MIDIA) {
      const valor = node.getAttribute(attr);
      if (valor && ehUrlMidiaValida(valor)) urls.add(decodificarEntidadesHtml(valor));
    }
    for (const bg of urlsDeBackground(node.getAttribute("style"))) {
      urls.add(bg);
    }
  }

  for (const doc of Array.from(el.querySelectorAll(SELETORES_DOCUMENTO))) {
    for (const img of Array.from(doc.querySelectorAll("img"))) {
      for (const attr of ATRIBUTOS_MIDIA) {
        const valor = img.getAttribute(attr);
        if (valor && ehUrlMidiaValida(valor)) urls.add(decodificarEntidadesHtml(valor));
      }
    }
    const htmlDoc = doc.innerHTML ?? "";
    for (const url of extrairMidiaUrlsDoHtmlBruto(htmlDoc)) {
      urls.add(url);
    }
  }

  return [...urls];
}

export function inferirTipoMidia(raw: Pick<RawPost, "midiaVideos" | "midiaImagens" | "midiaDocumentos">): TipoMidia {
  if (raw.midiaVideos > 0) return "video";
  if (raw.midiaDocumentos > 0) return "documento";
  if (raw.midiaImagens > 0) return "imagem";
  return "texto";
}

export function urlDoUrn(urn: string | null): string | null {
  if (!urn) return null;
  return `${ACTIVITY_BASE_URL}${urn}`;
}

function extrairUrnDeHref(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/urn:li:activity:\d+/);
  return match?.[0] ?? null;
}

/** Decodifica prefixos protobuf Cg[so]I... embutidos no HTML SDUI. */
export function decodificarActivityIdDeCgs(token: string): string | null {
  const prefix = token.split("-replaceable")[0] ?? "";
  if (!/^Cg[so]I/i.test(prefix)) return null;

  let buf: Buffer;
  try {
    buf = Buffer.from(prefix, "base64");
  } catch {
    return null;
  }

  if (buf.length < 4 || buf[0] !== 0x0a) return null;
  const len = buf[1];
  if (typeof len !== "number" || len < 2 || 2 + len > buf.length) return null;
  const inner = buf.subarray(2, 2 + len);
  if (inner[0] !== 0x08) return null;

  let result = 0n;
  let shift = 0n;
  for (let i = 1; i < inner.length; i++) {
    const b = BigInt(inner[i] ?? 0);
    result |= (b & 0x7fn) << shift;
    if ((b & 0x80n) === 0n) {
      const id = result.toString();
      return id.length >= 15 ? id : null;
    }
    shift += 7n;
  }
  return null;
}

function extrairOpaqueSdui(componentkey: string | null): string | null {
  if (!componentkey) return null;
  const match = componentkey.match(/update-card-focus(.+?)FeedType_/);
  return match?.[1] ?? null;
}

function extrairDataTexto(el: ParsedElement): string | null {
  const html = el.outerHTML ?? el.innerHTML ?? "";
  const match = html.match(/\b(\d{1,2}\s+de\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?)\b/i);
  return match?.[1] ?? null;
}

function extrairReacoesTexto(el: ParsedElement): string | null {
  const reacoesEl = el.querySelector(
    ".social-details-social-counts__reactions-count, .social-details-social-counts__social-proof-fallback-number",
  );
  if (reacoesEl?.textContent) return reacoesEl.textContent;

  const html = el.outerHTML ?? el.innerHTML ?? "";
  const match = html.match(/(\d[\d.,]*)\s*rea[cç][oõ]es/i);
  if (match?.[1]) return match[1];

  const botao = el.querySelector('button[aria-label*="rea"]');
  const span = botao?.querySelector("span span");
  return span?.textContent ?? null;
}

function contarMidiaLegacy(el: ParsedElement): Pick<RawPost, "midiaImagens" | "midiaVideos" | "midiaDocumentos"> {
  return {
    midiaImagens: el.querySelectorAll(`${SELETORES_IMAGEM} img, img.update-components-image__image`).length,
    midiaVideos: el.querySelectorAll(SELETORES_VIDEO).length,
    midiaDocumentos: el.querySelectorAll(SELETORES_DOCUMENTO).length,
  };
}

function contarMidiaSdui(el: ParsedElement, midiaUrls: string[]): Pick<RawPost, "midiaImagens" | "midiaVideos" | "midiaDocumentos"> {
  const html = el.outerHTML ?? el.innerHTML ?? "";
  const temVideo =
    el.querySelectorAll(SELETORES_VIDEO).length > 0 ||
    /media-player__player|linkedin-video|vjs-poster/i.test(html);
  const temDocumento =
    el.querySelectorAll(SELETORES_DOCUMENTO).length > 0 ||
    /ssplayer-document|document-s-container|Página \d+ de \d+/i.test(html);
  const temImagem =
    midiaUrls.some((u) => !u.includes("/playlist/") && !u.includes("/video/")) ||
    /articleshare-shrink|feedshare-shrink|dms\/image/i.test(html);

  return {
    midiaVideos: temVideo ? 1 : 0,
    midiaDocumentos: temDocumento ? 1 : 0,
    midiaImagens: !temVideo && !temDocumento && temImagem ? 1 : 0,
  };
}

export function normalizePost(raw: RawPost, profileUsername: string): PostDTO | null {
  const urn = raw.urn;
  const postId = urn ?? raw.postId ?? null;
  if (!postId) return null;

  const url = raw.url ?? urlDoUrn(urn) ?? "";
  const agora = raw.agora ?? new Date();
  const publicadoEm =
    (urn ? parsearDataDoUrn(urn) : "") || parsearDataPtBr(raw.publicadoEmTexto, agora) || "";

  return {
    postId,
    profileUsername,
    texto: limparTexto(raw.texto),
    url,
    publicadoEm,
    tipoMidia: inferirTipoMidia(raw),
    midiaUrls: raw.midiaUrls,
    reacoesCount: parsearReacoes(raw.reacoesTexto),
    coletadoEm: agora.toISOString(),
  };
}

function parsearLegacy(document: ParsedDocument, profileUsername: string, agora: Date): PostDTO[] {
  const containers = Array.from(
    document.querySelectorAll("[data-urn], .feed-shared-update-v2[data-urn]"),
  );

  const posts: PostDTO[] = [];
  const vistos = new Set<string>();

  for (const el of containers) {
    const urn = el.getAttribute("data-urn");
    if (!urn || !urn.includes("urn:li:activity")) continue;
    if (vistos.has(urn)) continue;

    const textoEl = el.querySelector(SELETORES_TEXTO);
    const contagem = contarMidiaLegacy(el);
    const midiaUrls = extrairMidiaUrls(el);
    const reacoesEl = el.querySelector(
      ".social-details-social-counts__reactions-count, .social-details-social-counts__social-proof-fallback-number",
    );

    const raw: RawPost = {
      urn,
      texto: textoEl?.textContent ?? "",
      ...contagem,
      midiaUrls,
      reacoesTexto: reacoesEl?.textContent ?? null,
      agora,
    };

    const post = normalizePost(raw, profileUsername);
    if (post) {
      vistos.add(urn);
      posts.push(post);
    }
  }

  return posts;
}

function parsearSdui(
  document: ParsedDocument,
  profileUsername: string,
  agora: Date,
): PostDTO[] {
  const items = Array.from(document.querySelectorAll('[role="listitem"]'));
  const posts: PostDTO[] = [];
  const vistos = new Set<string>();
  const perfilHref = `/in/${profileUsername.toLowerCase()}`;

  for (const el of items) {
    const textoEl = el.querySelector("[data-testid='expandable-text-box']");
    if (!textoEl?.textContent?.trim()) continue;

    const html = el.outerHTML ?? el.innerHTML ?? "";
    // Atividade do perfil mistura posts proprios com interacoes; so fica o card do autor.
    if (!html.toLowerCase().includes(perfilHref)) continue;
    if (!/menu de controle da publica/i.test(html)) continue;

    const updateHref =
      el.querySelector('a[href*="/feed/update/"]')?.getAttribute("href") ??
      html.match(/https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:activity:\d+\/?/)?.[0] ??
      null;
    // So usa activity id do href canonico. Os tokens Cg[so]I do SDUI nao sao snowflake confiavel.
    const urn = extrairUrnDeHref(updateHref);
    const opaque = extrairOpaqueSdui(el.getAttribute("componentkey"));
    const postId = urn ?? (opaque ? `sdui:${opaque}` : null);
    if (!postId || vistos.has(postId)) continue;

    const midiaUrls = extrairMidiaUrls(el);
    const contagem = contarMidiaSdui(el, midiaUrls);
    const publicadoEmTexto = extrairDataTexto(el);

    const raw: RawPost = {
      urn,
      postId,
      url: updateHref,
      publicadoEmTexto,
      texto: textoEl.textContent ?? "",
      ...contagem,
      midiaUrls,
      reacoesTexto: extrairReacoesTexto(el),
      agora,
    };

    const post = normalizePost(raw, profileUsername);
    if (post) {
      vistos.add(postId);
      posts.push(post);
    }
  }

  return posts;
}

/**
 * Extrai posts a partir do HTML da pagina de atividade.
 * Suporta o layout legado (data-urn) e o SDUI atual (role=listitem).
 */
export function parsearPostsDoHtml(
  html: string,
  profileUsername: string,
  options: ParseOptions = {},
): PostDTO[] {
  const { document } = parseHTML(html) as unknown as { document: ParsedDocument };
  const agora = options.agora ?? new Date();

  const legacy = parsearLegacy(document, profileUsername, agora);
  if (legacy.length > 0) {
    return legacy.sort(
      (a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime(),
    );
  }

  return parsearSdui(document, profileUsername, agora).sort(
    (a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime(),
  );
}
