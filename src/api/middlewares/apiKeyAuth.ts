import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import type { ApiError } from "../../shared/types.js";

/**
 * Valida o header `x-api-key`. Aplicado a todas as rotas exceto as marcadas
 * como publicas (ex.: /health).
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const chave = request.headers["x-api-key"];

  if (typeof chave !== "string" || chave !== env.apiKey) {
    const corpo: ApiError = { erro: "nao_autorizado", detalhe: "Header x-api-key ausente ou invalido" };
    await reply.code(401).send(corpo);
  }
}
