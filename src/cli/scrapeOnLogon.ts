import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { buscarPerfilPorUsername } from "../db/repositories/profiles.js";
import { executarColeta } from "../scheduler/collector.js";
import { ensureValidSession, loginInterativo } from "../scraper/session.js";
import { logger } from "../shared/logger.js";

const USERNAME = process.env.SCRAPE_USERNAME?.trim();

function possuiFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

async function main(): Promise<void> {
  if (!USERNAME) {
    throw new Error(
      "Defina SCRAPE_USERNAME no .env (slug do perfil LinkedIn, ex.: meu-usuario).",
    );
  }

  const forcar = possuiFlag("--force");
  const dryRun = possuiFlag("--dry-run");
  const sessao = await ensureValidSession();

  if (dryRun) {
    logger.info({ sessao, username: USERNAME }, "Verificacao de sessao concluida sem coleta");
    return;
  }

  if (sessao.valido && !forcar) {
    logger.info({ username: USERNAME }, "Coleta no logon pulada: sessao LinkedIn ainda valida.");
    return;
  }

  logger.info(
    { motivo: sessao.motivo, forcar, username: USERNAME },
    "Sessao LinkedIn requer login manual antes da coleta.",
  );
  await loginInterativo();

  await connectDatabase();
  try {
    const perfil = await buscarPerfilPorUsername(USERNAME);
    if (!perfil) {
      throw new Error(
        `Perfil ${USERNAME} nao cadastrado. Cadastre-o antes de habilitar a coleta no logon.`,
      );
    }

    const resultado = await executarColeta(USERNAME);
    if (resultado.status !== "sucesso") {
      throw new Error(resultado.erro ?? "Coleta finalizada sem sucesso.");
    }

    logger.info(
      { username: USERNAME, postsColetados: resultado.postsColetados },
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
