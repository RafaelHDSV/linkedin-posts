import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  parsearPostsDoHtml,
  parsearReacoes,
  parsearDataDoUrn,
  parsearDataPtBr,
  limparTexto,
  inferirTipoMidia,
  urlDoUrn,
  normalizePost,
  type RawPost,
} from "../src/scraper/postParser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "fixtures", "activity-sample.html"), "utf-8");
const htmlSdui = readFileSync(join(__dirname, "fixtures", "activity-sdui-sample.html"), "utf-8");

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

describe("parsearDataDoUrn", () => {
  it("decodifica timestamp real do LinkedIn", () => {
    expect(parsearDataDoUrn("urn:li:activity:7481014336287657986")).toBe(
      "2026-07-09T16:00:08.296Z",
    );
  });

  it("retorna vazio para urn invalido", () => {
    expect(parsearDataDoUrn("urn:li:share:123")).toBe("");
  });
});

describe("parsearDataPtBr", () => {
  const ref = new Date("2026-10-17T15:00:00.000Z");

  it("converte dia e mes abreviado", () => {
    expect(parsearDataPtBr("15 de out.", ref)).toBe("2026-10-15T12:00:00.000Z");
    expect(parsearDataPtBr("8 de out", ref)).toBe("2026-10-08T12:00:00.000Z");
  });

  it("volta um ano se a data cair no futuro em relacao a referencia", () => {
    expect(parsearDataPtBr("20 de dez.", new Date("2026-01-05T12:00:00.000Z"))).toBe(
      "2025-12-20T12:00:00.000Z",
    );
  });

  it("retorna vazio para texto invalido", () => {
    expect(parsearDataPtBr("ontem", ref)).toBe("");
    expect(parsearDataPtBr(null, ref)).toBe("");
  });
});

describe("limparTexto", () => {
  it("remove sufixo …mais e normaliza hashtags", () => {
    const bruto = "Post legal hashtag#React   \n\n    …mais";
    expect(limparTexto(bruto)).toBe("Post legal #React");
  });
});

describe("inferirTipoMidia", () => {
  it("prioriza video", () => {
    expect(inferirTipoMidia({ midiaVideos: 1, midiaImagens: 2, midiaDocumentos: 0 })).toBe("video");
  });

  it("detecta imagem", () => {
    expect(inferirTipoMidia({ midiaVideos: 0, midiaImagens: 1, midiaDocumentos: 0 })).toBe("imagem");
  });

  it("detecta documento", () => {
    expect(inferirTipoMidia({ midiaVideos: 0, midiaImagens: 0, midiaDocumentos: 1 })).toBe("documento");
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

  it("retorna null sem urn nem postId fallback", () => {
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

  it("aceita post SDUI com postId e data textual sem urn", () => {
    const raw: RawPost = {
      urn: null,
      postId: "sdui:opaque-key",
      url: null,
      publicadoEmTexto: "15 de out.",
      texto: "post novo",
      midiaImagens: 0,
      midiaVideos: 0,
      midiaDocumentos: 0,
      midiaUrls: [],
      reacoesTexto: "3",
      agora: new Date("2026-10-17T15:00:00.000Z"),
    };
    const post = normalizePost(raw, "rafael");
    expect(post?.postId).toBe("sdui:opaque-key");
    expect(post?.publicadoEm).toBe("2026-10-15T12:00:00.000Z");
    expect(post?.url).toBe("");
    expect(post?.reacoesCount).toBe(3);
  });

  it("preenche publicadoEm a partir do urn", () => {
    const raw: RawPost = {
      urn: "urn:li:activity:7481014336287657986",
      texto: "x",
      midiaImagens: 0,
      midiaVideos: 0,
      midiaDocumentos: 0,
      midiaUrls: [],
      reacoesTexto: null,
    };
    const post = normalizePost(raw, "rafael");
    expect(post?.publicadoEm).toBe("2026-07-09T16:00:08.296Z");
  });
});

describe("parsearPostsDoHtml", () => {
  const posts = parsearPostsDoHtml(html, "rafael-vieira1720");

  it("extrai apenas activities unicas (ignora share e duplicata)", () => {
    expect(posts).toHaveLength(4);
    const ids = posts.map((p) => p.postId);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain("urn:li:share:9999999999");
  });

  it("ordena por publicadoEm decrescente", () => {
    for (let i = 1; i < posts.length; i++) {
      const anterior = new Date(posts[i - 1].publicadoEm).getTime();
      const atual = new Date(posts[i].publicadoEm).getTime();
      expect(anterior).toBeGreaterThanOrEqual(atual);
    }
  });

  it("normaliza o post com imagem e reacoes", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:7463166740848455680");
    expect(post).toBeDefined();
    expect(post?.profileUsername).toBe("rafael-vieira1720");
    expect(post?.tipoMidia).toBe("imagem");
    expect(post?.reacoesCount).toBe(42);
    expect(post?.midiaUrls.length).toBeGreaterThan(0);
    expect(post?.publicadoEm).toBe("2026-05-21T10:00:09.951Z");
    expect(post?.url).toContain("urn:li:activity:7463166740848455680");
  });

  it("classifica post com video e extrai poster", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:7465703492964458496");
    expect(post?.tipoMidia).toBe("video");
    expect(post?.reacoesCount).toBe(1234);
    expect(post?.midiaUrls.length).toBeGreaterThan(0);
    expect(post?.midiaUrls[0]).toContain("video-poster");
  });

  it("classifica post apenas de texto", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:7473145054568701952");
    expect(post?.tipoMidia).toBe("texto");
    expect(post?.reacoesCount).toBe(1200);
    expect(post?.publicadoEm).toBe("2026-06-17T22:50:25.330Z");
  });

  it("classifica post com documento e extrai preview", () => {
    const post = posts.find((p) => p.postId === "urn:li:activity:7481014336287657986");
    expect(post?.tipoMidia).toBe("documento");
    expect(post?.midiaUrls.length).toBeGreaterThan(0);
    expect(post?.midiaUrls[0]).toContain("document-preview");
  });
});

describe("parsearPostsDoHtml SDUI", () => {
  const posts = parsearPostsDoHtml(htmlSdui, "rafael-vieira1720", {
    agora: new Date("2026-10-17T15:00:00.000Z"),
  });

  it("extrai posts do layout novo sem data-urn", () => {
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.some((p) => p.texto.includes("A IA responde bem"))).toBe(true);
  });

  it("usa data textual pt-BR quando nao ha snowflake classico", () => {
    const post = posts.find((p) => p.texto.includes("A IA responde bem"));
    expect(post?.publicadoEm).toBe("2026-10-15T12:00:00.000Z");
  });

  it("preserva url feed/update quando o card ainda expoe o href", () => {
    const post = posts.find((p) => p.texto.includes("Quanto falta para o almoço"));
    expect(post?.url).toContain("urn:li:activity:7511455502107709440");
    expect(post?.postId).toBe("urn:li:activity:7511455502107709440");
  });

  it("gera postId estavel para cards sem urn visivel", () => {
    const post = posts.find((p) => p.texto.includes("A IA responde bem"));
    expect(post?.postId).toMatch(/^(sdui:|urn:li:activity:)/);
  });
});
