import { PostModel } from "../db/models/Post.js";
import { ProfileModel } from "../db/models/Profile.js";
import { scrapeProfile } from "../scraper/profileScraper.js";
import { comBackoff } from "../shared/retry.js";
import { logger } from "../shared/logger.js";
import type { PostDTO } from "../shared/types.js";

export interface ColetaResultado {
  username: string;
  status: "sucesso" | "erro";
  postsColetados: number;
  erro?: string;
}

/** Numero de falhas consecutivas que dispara alerta (possivel sessao/bloqueio). */
const LIMITE_ALERTA_FALHAS = 3;

async function registrarFalha(username: string, erro: string): Promise<void> {
  const perfil = await ProfileModel.findOneAndUpdate(
    { username },
    { $set: { ultimaColetaEm: new Date(), ultimoStatus: "erro" }, $inc: { falhasConsecutivas: 1 } },
    { new: true },
  ).lean();

  const falhas = perfil?.falhasConsecutivas ?? 1;
  if (falhas >= LIMITE_ALERTA_FALHAS) {
    logger.error(
      { username, falhasConsecutivas: falhas, erro },
      "ALERTA: perfil com falhas consecutivas — verifique sessao do LinkedIn, bloqueio ou mudanca de layout",
    );
  } else {
    logger.warn({ username, falhasConsecutivas: falhas, erro }, "Coleta finalizada com erro");
  }
}

async function registrarSucesso(username: string): Promise<void> {
  await ProfileModel.updateOne(
    { username },
    { $set: { ultimaColetaEm: new Date(), ultimoStatus: "sucesso", falhasConsecutivas: 0 } },
  );
}

/** Upsert deduplicado por postId: nao gera duplicatas em reexecucoes. */
export async function upsertPosts(username: string, posts: PostDTO[]): Promise<void> {
  if (posts.length === 0) return;

  const operacoes = posts.map((post) => ({
    updateOne: {
      filter: { postId: post.postId },
      update: {
        $set: {
          profileUsername: username,
          texto: post.texto,
          url: post.url,
          publicadoEm: post.publicadoEm ? new Date(post.publicadoEm) : null,
          tipoMidia: post.tipoMidia,
          midiaUrls: post.midiaUrls,
          reacoesCount: post.reacoesCount,
          coletadoEm: new Date(post.coletadoEm),
        },
      },
      upsert: true,
    },
  }));

  await PostModel.bulkWrite(operacoes, { ordered: false });
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

    await upsertPosts(username, resultado.posts);
    await registrarSucesso(username);

    logger.info({ username, total: resultado.posts.length }, "Coleta concluida");
    return { username, status: "sucesso", postsColetados: resultado.posts.length };
  } catch (erro) {
    await registrarFalha(username, "erro_desconhecido").catch(() => undefined);
    logger.error({ username, erro }, "Falha inesperada na coleta");
    return { username, status: "erro", postsColetados: 0, erro: "erro_desconhecido" };
  }
}
