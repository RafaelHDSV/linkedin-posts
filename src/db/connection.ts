import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.connection.on("error", (erro) => {
    logger.error({ erro }, "Erro na conexao com o MongoDB");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("Conexao com o MongoDB encerrada");
  });

  await mongoose.connect(env.mongodbUri);
  logger.info("Conectado ao MongoDB");
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
