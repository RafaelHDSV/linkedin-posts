import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { buscarPerfilPorUsername } from "../db/repositories/profiles.js";
import { executarColeta } from "../scheduler/collector.js";
import { ensureValidSession, loginInterativo } from "../scraper/session.js";
import { logger } from "../shared/logger.js";

const USERNAME = process.env.SCRAPE_USERNAME?.trim();

function possuiFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

export interface AcaoLogon {
  /** Apenas validar a sessao (nao coletar) — usado por --dry-run. */
  apenasVerificar: boolean;
  /** Abrir login manual antes de coletar. */
  loginManual: boolean;
  /** Executar a coleta e persistir no Supabase. */
  coletar: boolean;
}

/**
 * Decide o que o fluxo de logon deve fazer, sem efeitos colaterais (testavel).
 *
 * Regra: `--dry-run` so valida a sessao; caso contrario SEMPRE coleta, abrindo
 * login manual quando a sessao esta invalida ou quando `--force` foi passado.
 */
export function decidirAcaoLogon(
  sessaoValida: boolean,
  opcoes: { forcar: boolean; dryRun: boolean },
): AcaoLogon {
  if (opcoes.dryRun) {
    return { apenasVerificar: true, loginManual: false, coletar: false };
  }

  return {
    apenasVerificar: false,
    loginManual: !sessaoValida || opcoes.forcar,
    coletar: true,
  };
}

async function coletarPerfil(username: string): Promise<void> {
  await connectDatabase();
  try {
    const perfil = await buscarPerfilPorUsername(username);
    if (!perfil) {
      throw new Error(
        `Perfil ${username} nao cadastrado. Cadastre-o antes de habilitar a coleta no logon.`,
      );
    }

    const resultado = await executarColeta(username);

    if (resultado.status !== "sucesso") {
      throw new Error(resultado.erro ?? "Coleta finalizada sem sucesso.");
    }

    if (resultado.postsColetados === 0) {
      logger.warn(
        { username, postsColetados: 0 },
        "Coleta no logon concluida sem posts extraidos — verifique layout do LinkedIn, perfil ou bloqueio.",
      );
      return;
    }

    logger.info(
      { username, postsColetados: resultado.postsColetados },
      "Coleta no logon concluida.",
    );
  } finally {
    await disconnectDatabase();
  }
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
  const acao = decidirAcaoLogon(sessao.valido, { forcar, dryRun });

  if (acao.apenasVerificar) {
    logger.info({ sessao, username: USERNAME }, "Verificacao de sessao concluida sem coleta");
    return;
  }

  if (acao.loginManual) {
    logger.info(
      { motivo: sessao.motivo, forcar, username: USERNAME },
      "Sessao LinkedIn requer login manual antes da coleta.",
    );
    await loginInterativo();
  } else {
    logger.info({ username: USERNAME }, "Sessao LinkedIn valida — coletando no logon.");
  }

  await coletarPerfil(USERNAME);
}

/** So executa o fluxo quando rodado diretamente (nao ao ser importado em testes). */
const executadoDiretamente =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  main().catch((erro) => {
    logger.error({ erro }, "Falha na coleta executada durante o logon.");
    process.exitCode = 1;
  });
}
