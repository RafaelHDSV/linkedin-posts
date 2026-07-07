import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  parsearPostsDoHtml,
  parsearReacoes,
  inferirTipoMidia,
  urlDoUrn,
  normalizePost,
  type RawPost,
} from "../src/scraper/postParser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "fixtures", "activity-sample.html"), "utf-8");

describe("parsearReacoes", () => {
  it("interpreta numeros simples", () => {
    expect(parsearReacoes("42")).toBe(42);
  });

  it("interpreta separador de milhar", () => {
    expect(parsearReacoes("1.234")).toBe(1234);
  });

  it("interpreta sufixo mil com decimal", () => {
    expect(parsearReacoes("1,2 mil")).toBe(1200);
  });

  it("interpreta sufixo K", () => {
    expect(parsearReacoes("2K")).toBe(2000);
  });

  it("retorna undefined para vazio", () => {
    expect(parsearReacoes(null)).toBeUndefined();
    expect(parsearReacoes("")).toBeUndefined();
  });
});

describe("inferirTipoMidia", () => {
  it("prioriza video", () => {
    expect(inferirTipoMidia({ midiaVideos: 1, midiaImagens: 2, midiaDocumentos: 0 })).toBe("video");
  });

  it("detecta imagem", () => {
    expect(inferirTipoMidia({ midiaVideos: 0, midiaImagens: 1, midiaDocumentos: 0 })).toBe("imagem");
  });

  it("cai para texto sem midia", () => {
    expect(inferirTipoMidia({ midiaVideos: 0, midiaImagens: 0, midiaDocumentos: 0 })).toBe("texto");
  });
});

describe("urlDoUrn / normalizePost", () => {
  it("monta url a partir do urn", () => {
    expect(urlDoUrn("urn:li:activity:1")).toContain("urn:li:activity:1");
    expect(urlDoUrn(null)).toBeNull();
  });

  it("retorna null sem urn", () => {
    const raw: RawPost = {
      urn: null,
      texto: "x",
      midiaImagens: 0,
      midiaVideos: 0,
      midiaDocumentos: 0,
      midiaUrls: [],
      reacoesTexto: null,
    };
    expect(normalizePost(raw, "rafael")).toBeNull();
  });
});

describe("parsearPostsDoHtml", () => {
  const posts = parsearPostsDoHtml(html, "rafael-vieira1720");

  it("extrai apenas activities unicas (ignora share e duplicata)", () => {
    expect(posts).toHaveLength(3);
    const ids = posts.map((p) => p.postId);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain("urn:li:share:9999999999");
  });

  it("normaliza o primeiro post com imagem e reacoes", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:1111111111");
    expect(post).toBeDefined();
    expect(post?.profileUsername).toBe("rafael-vieira1720");
    expect(post?.tipoMidia).toBe("imagem");
    expect(post?.reacoesCount).toBe(42);
    expect(post?.midiaUrls.length).toBeGreaterThan(0);
    expect(post?.url).toContain("urn:li:activity:1111111111");
  });

  it("classifica post com video", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:2222222222");
    expect(post?.tipoMidia).toBe("video");
    expect(post?.reacoesCount).toBe(1234);
  });

  it("classifica post apenas de texto", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:3333333333");
    expect(post?.tipoMidia).toBe("texto");
    expect(post?.reacoesCount).toBe(1200);
  });
});
