import { connectDatabase, disconnectDatabase } from "./db/connection.js";
import { agendarColetas } from "./scheduler/cronJobs.js";
import { startServer } from "./api/server.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";

async function main(): Promise<void> {
  await connectDatabase();

  if (!env.isVercel) {
    agendarColetas();
  } else {
    logger.info("Ambiente Vercel: coleta via /api/cron/scrape (sem node-cron local)");
  }

  await startServer();
  logger.info("Servico linkedin-posts-api inicializado");
}

async function shutdown(sinal: string): Promise<void> {
  logger.info({ sinal }, "Encerrando servico");
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((erro) => {
  logger.error({ erro }, "Falha ao inicializar o servico");
  process.exit(1);
});
