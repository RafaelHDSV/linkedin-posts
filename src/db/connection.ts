import { getSupabase } from "./supabase.js";
import { TABLES } from "./tables.js";
import { logger } from "../shared/logger.js";

export async function connectDatabase(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLES.profiles)
    .select("username", { head: true, count: "exact" });

  if (error) {
    logger.error({ erro: error }, "Falha ao conectar ao Supabase");
    throw new Error(
      `Supabase indisponivel ou schema nao aplicado: ${error.message}. Veja supabase/migrations/ e docs/hospedagem-vercel.md`,
    );
  }

  logger.info("Conectado ao Supabase (PostgreSQL)");
}

export async function disconnectDatabase(): Promise<void> {
  // Cliente HTTP stateless — nada a encerrar.
}
