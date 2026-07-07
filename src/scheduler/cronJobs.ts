import cron, { type ScheduledTask } from "node-cron";
import { ProfileModel } from "../db/models/Profile.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { executarColeta } from "./collector.js";

let executando = false;

function coletaVencida(ultimaColetaEm: Date | null, intervaloHoras: number): boolean {
  if (!ultimaColetaEm) return true;
  const proxima = ultimaColetaEm.getTime() + intervaloHoras * 60 * 60 * 1_000;
  return Date.now() >= proxima;
}

/** Processa em lotes limitados por SCRAPE_CONCURRENCY; falha em um perfil nao bloqueia os demais. */
async function processarLote(usernames: string[], concorrencia: number): Promise<void> {
  for (let i = 0; i < usernames.length; i += concorrencia) {
    const fatia = usernames.slice(i, i + concorrencia);
    await Promise.all(
      fatia.map((username) =>
        executarColeta(username).catch((erro) => {
          logger.error({ username, erro }, "Erro isolado na coleta do perfil");
        }),
      ),
    );
  }
}

export async function rodarCicloDeColeta(): Promise<void> {
  if (executando) {
    logger.warn("Ciclo de coleta anterior ainda em execucao; pulando este disparo");
    return;
  }
  executando = true;
  const inicio = Date.now();

  try {
    const perfis = await ProfileModel.find({ ativo: true }).lean();
    const pendentes = perfis
      .filter((p) =>
        coletaVencida(
          p.ultimaColetaEm ?? null,
          p.intervaloColetaHoras ?? env.scrapeIntervalHours,
        ),
      )
      .map((p) => p.username);

    if (pendentes.length === 0) {
      logger.debug("Nenhum perfil vencido neste ciclo");
      return;
    }

    logger.info({ total: pendentes.length }, "Iniciando ciclo de coleta");
    await processarLote(pendentes, Math.max(1, env.scrapeConcurrency));
    logger.info({ duracaoMs: Date.now() - inicio }, "Ciclo de coleta finalizado");
  } catch (erro) {
    logger.error({ erro }, "Falha no ciclo de coleta");
  } finally {
    executando = false;
  }
}

/**
 * Agenda o ciclo de coleta. Roda de hora em hora e, dentro do ciclo,
 * cada perfil so e coletado quando seu intervalo individual vence.
 */
export function agendarColetas(): ScheduledTask {
  const tarefa = cron.schedule("0 * * * *", () => {
    void rodarCicloDeColeta();
  });
  logger.info("Scheduler de coleta agendado (a cada hora)");
  // Dispara um ciclo inicial logo apos o start (perfis novos/vencidos).
  void rodarCicloDeColeta();
  return tarefa;
}
