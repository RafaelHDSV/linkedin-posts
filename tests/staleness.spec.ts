import { describe, it, expect } from "vitest";
import { avaliarFrescorColeta } from "../src/scheduler/staleness.js";
import type { PostDTO } from "../src/shared/types.js";

function post(parcial: Partial<PostDTO> & Pick<PostDTO, "publicadoEm">): PostDTO {
  return {
    postId: parcial.postId ?? "urn:li:activity:1",
    profileUsername: parcial.profileUsername ?? "rafael-vieira1720",
    texto: parcial.texto ?? "x",
    url: parcial.url ?? "https://www.linkedin.com/feed/update/urn:li:activity:1/",
    publicadoEm: parcial.publicadoEm,
    tipoMidia: parcial.tipoMidia ?? "texto",
    midiaUrls: parcial.midiaUrls ?? [],
    reacoesCount: parcial.reacoesCount,
    coletadoEm: parcial.coletadoEm ?? "2026-11-04T12:00:00.000Z",
  };
}

describe("avaliarFrescorColeta", () => {
  const agora = new Date("2026-11-04T15:00:00.000Z");

  it("marca fresco quando o mais recente esta dentro da janela", () => {
    const resultado = avaliarFrescorColeta(
      [
        post({ publicadoEm: "2026-10-30T12:00:00.000Z" }),
        post({ publicadoEm: "2026-10-01T12:00:00.000Z" }),
      ],
      { agora, limiteDias: 8 },
    );
    expect(resultado).toEqual({
      stale: false,
      maxPublicadoEm: "2026-10-30T12:00:00.000Z",
    });
  });

  it("marca cache_stale quando o mais recente e mais velho que N dias", () => {
    const resultado = avaliarFrescorColeta(
      [
        post({ publicadoEm: "2026-10-01T16:02:27.797Z" }),
        post({ publicadoEm: "2026-09-24T12:00:00.000Z" }),
      ],
      { agora, limiteDias: 8 },
    );
    expect(resultado.stale).toBe(true);
    expect(resultado.maxPublicadoEm).toBe("2026-10-01T16:02:27.797Z");
    expect(resultado.limiteDias).toBe(8);
  });

  it("marca stale quando nao ha posts com data valida", () => {
    const resultado = avaliarFrescorColeta(
      [post({ publicadoEm: "" }), post({ publicadoEm: "nao-e-data" })],
      { agora, limiteDias: 8 },
    );
    expect(resultado.stale).toBe(true);
    expect(resultado.maxPublicadoEm).toBeNull();
  });

  it("marca stale para lote vazio", () => {
    const resultado = avaliarFrescorColeta([], { agora, limiteDias: 8 });
    expect(resultado.stale).toBe(true);
    expect(resultado.maxPublicadoEm).toBeNull();
  });
});
