import type { FastifyInstance } from "fastify";
import { ProfileModel } from "../../db/models/Profile.js";
import { PostModel } from "../../db/models/Post.js";
import { env } from "../../config/env.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import type { ApiError } from "../../shared/types.js";

interface CreateProfileBody {
  username: string;
}

function normalizarUsername(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  // Aceita URL completa ou username puro.
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

    const existente = await ProfileModel.findOne({ username }).lean();
    if (existente) {
      return reply.code(200).send({ mensagem: "Perfil ja monitorado", username });
    }

    const perfil = await ProfileModel.create({
      username,
      url: `https://www.linkedin.com/in/${username}/`,
      ativo: true,
      intervaloColetaHoras: env.scrapeIntervalHours,
    });

    return reply.code(201).send({
      username: perfil.username,
      url: perfil.url,
      ativo: perfil.ativo,
      intervaloColetaHoras: perfil.intervaloColetaHoras,
    });
  });

  app.get("/profiles", async () => {
    const perfis = await ProfileModel.find().sort({ createdAt: -1 }).lean();
    return perfis.map((p) => ({
      username: p.username,
      url: p.url,
      ativo: p.ativo,
      intervaloColetaHoras: p.intervaloColetaHoras,
      ultimaColetaEm: p.ultimaColetaEm ?? null,
      ultimoStatus: p.ultimoStatus ?? null,
    }));
  });

  app.delete<{ Params: { username: string }; Querystring: { comPosts?: string } }>(
    "/profiles/:username",
    async (request, reply) => {
      const { username } = request.params;
      const resultado = await ProfileModel.deleteOne({ username });

      if (resultado.deletedCount === 0) {
        const erro: ApiError = { erro: "perfil_nao_encontrado" };
        return reply.code(404).send(erro);
      }

      if (request.query.comPosts === "true") {
        await PostModel.deleteMany({ profileUsername: username });
      }

      return reply.code(200).send({ removido: username });
    },
  );
}
