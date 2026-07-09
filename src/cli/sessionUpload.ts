import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { enviarSessaoParaNuvem } from "../storage/sessionStorage.js";
import { logger } from "../shared/logger.js";

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await enviarSessaoParaNuvem();
    logger.info("Upload concluido. A coleta na Vercel pode usar a sessao atualizada.");
  } finally {
    await disconnectDatabase();
  }
}

main().catch((erro) => {
  logger.error({ erro }, "Falha no upload da sessao");
  process.exit(1);
});
