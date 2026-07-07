import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { healthRoutes } from "./routes/health.js";
// logger compartilhado usado fora do ciclo de request (startup)
import { profileRoutes } from "./routes/profiles.js";
import { postRoutes } from "./routes/posts.js";

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: { level: env.logLevel } });

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({ erro: "rota_nao_encontrada", detalhe: `${request.method} ${request.url}` });
  });

  app.setErrorHandler((erro: FastifyError, request, reply) => {
    const status = erro.statusCode && erro.statusCode >= 400 ? erro.statusCode : 500;
    if (status >= 500) {
      logger.error({ erro, rota: request.url }, "Erro nao tratado na API");
    }
    void reply.code(status).send({
      erro: status >= 500 ? "erro_interno" : "requisicao_invalida",
      detalhe: status >= 500 ? undefined : erro.message,
    });
  });

  app.register(healthRoutes);
  app.register(profileRoutes);
  app.register(postRoutes);

  return app;
}

export async function startServer(): Promise<FastifyInstance> {
  const app = buildServer();
  await app.listen({ port: env.port, host: "0.0.0.0" });
  logger.info({ porta: env.port }, "API REST ouvindo");
  return app;
}
