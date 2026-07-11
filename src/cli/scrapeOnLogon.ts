import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { buscarPerfilPorUsername } from "../db/repositories/profiles.js";
import { executarColeta } from "../scheduler/collector.js";
import { ensureValidSession, loginInterativo } from "../scraper/session.js";
import { logger } from "../shared/logger.js";

const USERNAME_PADRAO = process.env.SCRAPE_USERNAME?.trim() || "rafael-vieira1720";

function possuiFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

async function main(): Promise<void> {
  const forcar = possuiFlag("--force");
  const dryRun = possuiFlag("--dry-run");
  const sessao = await ensureValidSession();

  if (dryRun) {
    logger.info({ sessao }, "Verificacao de sessao concluida sem coleta");
    return;
  }

  if (sessao.valido && !forcar) {
    logger.info("Coleta no logon pulada: sessao LinkedIn ainda valida.");
    return;
  }

  logger.info(
    { motivo: sessao.motivo, forcar },
    "Sessao LinkedIn requer login manual antes da coleta.",
  );
  await loginInterativo();

  await connectDatabase();
  try {
    const perfil = await buscarPerfilPorUsername(USERNAME_PADRAO);
    if (!perfil) {
      throw new Error(
        `Perfil ${USERNAME_PADRAO} nao cadastrado. Cadastre-o antes de habilitar a coleta no logon.`,
      );
    }

    const resultado = await executarColeta(USERNAME_PADRAO);
    if (resultado.status !== "sucesso") {
      throw new Error(resultado.erro ?? "Coleta finalizada sem sucesso.");
    }

    logger.info(
      { username: USERNAME_PADRAO, postsColetados: resultado.postsColetados },
      "Coleta no logon concluida.",
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((erro) => {
  logger.error({ erro }, "Falha na coleta executada durante o logon.");
  process.exitCode = 1;
});
