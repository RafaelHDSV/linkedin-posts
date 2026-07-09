import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { buscarPerfilPorUsername } from "../db/repositories/profiles.js";
import { executarColeta } from "../scheduler/collector.js";
import { logger } from "../shared/logger.js";

function normalizarUsername(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  const match = bruto.match(/linkedin\.com\/in\/([^/?#]+)/i);
  const username = match?.[1] ?? bruto;
  return username.replace(/^@/, "").trim() || null;
}

async function main(): Promise<void> {
  const bruto = process.argv[2];
  if (!bruto) {
    console.error("Uso: yarn scrape <username ou URL do LinkedIn>");
    console.error("Ex.: yarn scrape rafael-vieira1720");
    process.exit(1);
  }

  const username = normalizarUsername(bruto);
  if (!username) {
    console.error("Username invalido.");
    process.exit(1);
  }

  await connectDatabase();

  const perfil = await buscarPerfilPorUsername(username);
  if (!perfil) {
    logger.error(
      { username },
      "Perfil nao cadastrado. Cadastre antes via POST /profiles ou curl.",
    );
    process.exit(1);
  }

  logger.info({ username }, "Coleta manual iniciada (ignora intervalo do cron)");
  const resultado = await executarColeta(username);

  await disconnectDatabase();

  if (resultado.status === "sucesso") {
    logger.info(
      { username, postsColetados: resultado.postsColetados },
      "Coleta manual concluida",
    );
    process.exit(0);
  }

  logger.error({ username, erro: resultado.erro }, "Coleta manual falhou");
  process.exit(1);
}

main().catch((erro) => {
  logger.error({ erro }, "Erro inesperado na coleta manual");
  process.exit(1);
});
