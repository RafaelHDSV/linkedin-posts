import type { FastifyInstance } from "fastify";
import { ProfileModel } from "../../db/models/Profile.js";
import { PostModel } from "../../db/models/Post.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import type { ApiError, PostDTO, PostsResponse, TipoMidia } from "../../shared/types.js";

interface PostsQuery {
  limit?: string;
  page?: string;
}

function paginacao(query: PostsQuery): { limit: number; page: number; skip: number } {
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
}

export async function postRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", apiKeyAuth);

  app.get<{ Params: { username: string }; Querystring: PostsQuery }>(
    "/profiles/:username/posts",
    async (request, reply) => {
      const { username } = request.params;
      const { limit, page, skip } = paginacao(request.query);

      const perfil = await ProfileModel.findOne({ username }).lean();
      if (!perfil) {
        const erro: ApiError = { erro: "perfil_nao_encontrado", detalhe: `Perfil '${username}' nao cadastrado` };
        return reply.code(404).send(erro);
      }

      const [documentos, total] = await Promise.all([
        PostModel.find({ profileUsername: username })
          .sort({ publicadoEm: -1, coletadoEm: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments({ profileUsername: username }),
      ]);

      const posts: PostDTO[] = documentos.map((d) => ({
        postId: d.postId,
        profileUsername: d.profileUsername,
        texto: d.texto ?? "",
        url: d.url,
        publicadoEm: d.publicadoEm ? new Date(d.publicadoEm).toISOString() : "",
        tipoMidia: (d.tipoMidia ?? "texto") as TipoMidia,
        midiaUrls: d.midiaUrls ?? [],
        reacoesCount: d.reacoesCount ?? undefined,
        coletadoEm: d.coletadoEm ? new Date(d.coletadoEm).toISOString() : "",
      }));

      const resposta: PostsResponse = {
        profile: username,
        posts,
        pagination: { page, limit, total },
      };
      return reply.send(resposta);
    },
  );
}
