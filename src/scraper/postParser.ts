import { parseHTML } from "linkedom";
import type { PostDTO, TipoMidia } from "../shared/types.js";

export interface RawPost {
  urn: string | null;
  texto: string;
  midiaImagens: number;
  midiaVideos: number;
  midiaDocumentos: number;
  midiaUrls: string[];
  reacoesTexto: string | null;
}

const ACTIVITY_BASE_URL = "https://www.linkedin.com/feed/update/";
/** LinkedIn epoch minimo para IDs validos (2010-01-01). */
const EPOCH_MS_MINIMO = 1_262_304_000_000;

/**
 * Interface estrutural minima dos nos retornados pelo linkedom.
 * Evita depender da lib DOM do TypeScript (nao habilitada no tsconfig).
 */
interface ParsedElement {
  getAttribute(nome: string): string | null;
  textContent: string | null;
  innerHTML?: string;
  querySelector(seletor: string): ParsedElement | null;
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

interface ParsedDocument {
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

const SELETORES_TEXTO =
  ".update-components-text, .feed-shared-update-v2__description, .feed-shared-text, .feed-shared-inline-show-more-text";

const SELETORES_IMAGEM =
  ".update-components-image, .feed-shared-image, .update-components-article__image, .feed-shared-external-video__image";

const SELETORES_VIDEO =
  "video, .update-components-linkedin-video, .feed-shared-external-video, [data-test-article-video], .update-components-linkedin-native-video, .vjs-poster, .vjs-poster-background, .media-player__player";

const SELETORES_DOCUMENTO =
  ".update-components-document, .document-s-container, .ssplayer-document, .update-components-document__container";

const ATRIBUTOS_MIDIA = ["src", "data-delayed-url", "data-ghost-url", "data-src", "poster"] as const;

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
    if (ms < EPOCH_MS_MINIMO) return "";
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}

export function limparTexto(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .replace(/\s*…mais\s*$/i, "")
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

export function normalizePost(raw: RawPost, profileUsername: string): PostDTO | null {
  if (!raw.urn) return null;
  const url = urlDoUrn(raw.urn);
  if (!url) return null;

  return {
    postId: raw.urn,
    profileUsername,
    texto: limparTexto(raw.texto),
    url,
    publicadoEm: parsearDataDoUrn(raw.urn),
    tipoMidia: inferirTipoMidia(raw),
    midiaUrls: raw.midiaUrls,
    reacoesCount: parsearReacoes(raw.reacoesTexto),
    coletadoEm: new Date().toISOString(),
  };
}

/**
 * Extrai posts a partir do HTML da pagina de atividade.
 * Funcao pura (usa linkedom), o que a torna testavel com fixtures — sem navegador.
 */
export function parsearPostsDoHtml(html: string, profileUsername: string): PostDTO[] {
  const { document } = parseHTML(html) as unknown as { document: ParsedDocument };
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
    const midiaImagens = el.querySelectorAll(`${SELETORES_IMAGEM} img, img.update-components-image__image`).length;
    const midiaVideos = el.querySelectorAll(SELETORES_VIDEO).length;
    const midiaDocumentos = el.querySelectorAll(SELETORES_DOCUMENTO).length;
    const midiaUrls = extrairMidiaUrls(el);

    const reacoesEl = el.querySelector(
      ".social-details-social-counts__reactions-count, .social-details-social-counts__social-proof-fallback-number",
    );

    const raw: RawPost = {
      urn,
      texto: textoEl?.textContent ?? "",
      midiaImagens,
      midiaVideos,
      midiaDocumentos,
      midiaUrls,
      reacoesTexto: reacoesEl?.textContent ?? null,
    };

    const post = normalizePost(raw, profileUsername);
    if (post) {
      vistos.add(urn);
      posts.push(post);
    }
  }

  return posts.sort(
    (a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime(),
  );
}
