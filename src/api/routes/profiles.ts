import type { FastifyInstance } from "fastify";
import {
  buscarPerfilPorUsername,
  criarPerfil,
  listarPerfis,
  removerPerfil,
} from "../../db/repositories/profiles.js";
import { removerPostsDoPerfil } from "../../db/repositories/posts.js";
import { env } from "../../config/env.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import type { ApiError } from "../../shared/types.js";

interface CreateProfileBody {
  username: string;
}

function normalizarUsername(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  const match = bruto.match(/linkedin\.com\/in\/([^/?#]+)/i);
  const username = match?.[1] ?? bruto;
  return username.replace(/^@/, "").trim() || null;
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", apiKeyAuth);

  app.post<{ Body: CreateProfileBody }>("/profiles", async (request, reply) => {
    const username = normalizarUsername(request.body?.username ?? "");
    if (!username) {
      const erro: ApiError = { erro: "requisicao_invalida", detalhe: "Campo username obrigatorio" };
      return reply.code(400).send(erro);
    }

    const existente = await buscarPerfilPorUsername(username);
    if (existente) {
      return reply.code(200).send({ mensagem: "Perfil ja monitorado", username });
    }

    const perfil = await criarPerfil({
      username,
      url: `https://www.linkedin.com/in/${username}/`,
      intervaloColetaHoras: env.scrapeIntervalHours,
    });

    return reply.code(201).send({
      username: perfil.username,
      url: perfil.url,
      ativo: perfil.ativo,
      intervaloColetaHoras: perfil.intervalo_coleta_horas,
    });
  });

  app.get("/profiles", async () => {
    const perfis = await listarPerfis();
    return perfis.map((p) => ({
      username: p.username,
      url: p.url,
      ativo: p.ativo,
      intervaloColetaHoras: p.intervalo_coleta_horas,
      ultimaColetaEm: p.ultima_coleta_em,
      ultimoStatus: p.ultimo_status,
    }));
  });

  app.delete<{ Params: { username: string }; Querystring: { comPosts?: string } }>(
    "/profiles/:username",
    async (request, reply) => {
      const { username } = request.params;
      const existente = await buscarPerfilPorUsername(username);

      if (!existente) {
        const erro: ApiError = { erro: "perfil_nao_encontrado" };
        return reply.code(404).send(erro);
      }

      if (request.query.comPosts === "true") {
        await removerPostsDoPerfil(username);
      }

      await removerPerfil(username);
      return reply.code(200).send({ removido: username });
    },
  );
}
