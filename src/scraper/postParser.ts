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

/**
 * Interface estrutural minima dos nos retornados pelo linkedom.
 * Evita depender da lib DOM do TypeScript (nao habilitada no tsconfig).
 */
interface ParsedElement {
  getAttribute(nome: string): string | null;
  textContent: string | null;
  querySelector(seletor: string): ParsedElement | null;
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

interface ParsedDocument {
  querySelectorAll(seletor: string): ArrayLike<ParsedElement>;
}

/** Converte "1.234", "1,2 mil", "1.2K", "2M" em numero aproximado. */
export function parsearReacoes(texto: string | null | undefined): number | undefined {
  if (!texto) return undefined;
  const limpo = texto.trim().toLowerCase().replace(/\s+/g, " ");
  const match = limpo.match(/([\d.,]+)\s*(mil|mi|m|k)?/i);
  if (!match) return undefined;

  const numeroBruto = match[1];
  const sufixo = match[2];
  if (!numeroBruto) return undefined;

  // Locale pt-BR: "," e o separador decimal e "." o de milhar.
  // Com sufixo (mil/mi/k/m) o numero pode ter decimal ("1,2 mil"); sem sufixo,
  // contadores sao inteiros ("1.234" = 1234), entao removemos ambos separadores.
  const normalizado = sufixo
    ? numeroBruto.replace(/\./g, "").replace(",", ".")
    : numeroBruto.replace(/[.,]/g, "");

  let valor = Number(normalizado);
  if (Number.isNaN(valor)) return undefined;

  if (sufixo === "k" || sufixo === "mil") valor *= 1_000;
  else if (sufixo === "m" || sufixo === "mi") valor *= 1_000_000;

  return Math.round(valor);
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
    texto: raw.texto.trim(),
    url,
    publicadoEm: "",
    tipoMidia: inferirTipoMidia(raw),
    midiaUrls: raw.midiaUrls,
    reacoesCount: parsearReacoes(raw.reacoesTexto),
    coletadoEm: new Date().toISOString(),
  };
}

/**
 * Extrai posts a partir do HTML da pagina de atividade.
 * Funcao pura (usa linkedom), o que a torna testavel com fixtures — sem navegador.
 *
 * Os seletores sao best-effort para o layout atual do LinkedIn e estao isolados
 * aqui para facilitar ajuste quando o layout mudar (ver riscos da epic).
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

    const textoEl = el.querySelector(
      ".update-components-text, .feed-shared-update-v2__description, .feed-shared-text",
    );
    const midiaImagens = el.querySelectorAll(
      ".update-components-image img, img.update-components-image__image",
    ).length;
    const midiaVideos = el.querySelectorAll("video, .update-components-linkedin-video").length;
    const midiaDocumentos = el.querySelectorAll(
      ".update-components-document, .document-s-container",
    ).length;
    const midiaUrls = Array.from(el.querySelectorAll(".update-components-image img"))
      .map((img: ParsedElement) => img.getAttribute("src"))
      .filter((src): src is string => Boolean(src));

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

  return posts;
}
