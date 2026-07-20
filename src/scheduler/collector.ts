import {
  registrarColetaFalha,
  registrarColetaSucesso,
} from "../db/repositories/profiles.js";
import { upsertPosts } from "../db/repositories/posts.js";
import { scrapeProfile } from "../scraper/profileScraper.js";
import { comBackoff } from "../shared/retry.js";
import { logger } from "../shared/logger.js";

export interface ColetaResultado {
  username: string;
  status: "sucesso" | "erro";
  postsColetados: number;
  erro?: string;
}

/** Numero de falhas consecutivas que dispara alerta (possivel sessao/bloqueio). */
const LIMITE_ALERTA_FALHAS = 3;

async function registrarFalha(username: string, erro: string): Promise<void> {
  const { falhasConsecutivas } = await registrarColetaFalha(username);

  if (falhasConsecutivas >= LIMITE_ALERTA_FALHAS) {
    logger.error(
      { username, falhasConsecutivas, erro },
      "ALERTA: perfil com falhas consecutivas — verifique sessao do LinkedIn, bloqueio ou mudanca de layout",
    );
  } else {
    logger.warn({ username, falhasConsecutivas, erro }, "Coleta finalizada com erro");
  }
}

export async function executarColeta(username: string): Promise<ColetaResultado> {
  try {
    const resultado = await comBackoff(() => scrapeProfile(username), {
      tentativas: 3,
      delayInicialMs: 2_000,
      rotulo: `coleta:${username}`,
    });

    if (resultado.erro) {
      await registrarFalha(username, resultado.erro);
      return { username, status: "erro", postsColetados: 0, erro: resultado.erro };
    }

    try {
      await upsertPosts(username, resultado.posts);
    } catch (erroPersistencia) {
      await registrarFalha(username, "falha_persistencia");
      logger.error(
        { username, erro: erroPersistencia },
        "Falha ao persistir posts no Supabase (scrape ok, gravacao falhou)",
      );
      return { username, status: "erro", postsColetados: 0, erro: "falha_persistencia" };
    }

    await registrarColetaSucesso(username);

    logger.info({ username, total: resultado.posts.length }, "Coleta concluida");
    return { username, status: "sucesso", postsColetados: resultado.posts.length };
  } catch (erro) {
    await registrarFalha(username, "erro_desconhecido").catch(() => undefined);
    logger.error({ username, erro }, "Falha inesperada na coleta");
    return { username, status: "erro", postsColetados: 0, erro: "erro_desconhecido" };
  }
}
