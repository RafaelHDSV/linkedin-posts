import type { PostDTO } from "../shared/types.js";

export interface FrescorOpcoes {
  agora?: Date;
  limiteDias: number;
}

export interface FrescorResultado {
  stale: boolean;
  maxPublicadoEm: string | null;
  limiteDias?: number;
}

function timestampValido(iso: string): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Avalia se o lote coletado esta fresco o bastante para registrar sucesso.
 * Lote vazio ou sem datas validas conta como stale (falha visivel).
 */
export function avaliarFrescorColeta(
  posts: PostDTO[],
  opcoes: FrescorOpcoes,
): FrescorResultado {
  const agora = opcoes.agora ?? new Date();
  const limiteMs = opcoes.limiteDias * 24 * 60 * 60 * 1000;
  const limiar = agora.getTime() - limiteMs;

  let maxMs: number | null = null;
  let maxIso: string | null = null;

  for (const post of posts) {
    const ms = timestampValido(post.publicadoEm);
    if (ms === null) continue;
    if (maxMs === null || ms > maxMs) {
      maxMs = ms;
      maxIso = post.publicadoEm;
    }
  }

  if (maxMs === null) {
    return { stale: true, maxPublicadoEm: null, limiteDias: opcoes.limiteDias };
  }

  const stale = maxMs < limiar;
  return {
    stale,
    maxPublicadoEm: maxIso,
    ...(stale ? { limiteDias: opcoes.limiteDias } : {}),
  };
}
