import type { FastifyInstance } from "fastify";
import { buscarPerfilPorUsername } from "../../db/repositories/profiles.js";
import { listarPostsPaginados } from "../../db/repositories/posts.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import type { ApiError, PostDTO, PostsResponse } from "../../shared/types.js";

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

      const perfil = await buscarPerfilPorUsername(username);
      if (!perfil) {
        const erro: ApiError = { erro: "perfil_nao_encontrado", detalhe: `Perfil '${username}' nao cadastrado` };
        return reply.code(404).send(erro);
      }

      const { posts: linhas, total } = await listarPostsPaginados(username, skip, limit);

      const posts: PostDTO[] = linhas.map((d) => ({
        postId: d.post_id,
        profileUsername: d.profile_username,
        texto: d.texto ?? "",
        url: d.url,
        publicadoEm: d.publicado_em ? new Date(d.publicado_em).toISOString() : "",
        tipoMidia: d.tipo_midia,
        midiaUrls: d.midia_urls ?? [],
        reacoesCount: d.reacoes_count ?? undefined,
        coletadoEm: d.coletado_em ? new Date(d.coletado_em).toISOString() : "",
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
