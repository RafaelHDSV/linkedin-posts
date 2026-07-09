import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDatabase, disconnectDatabase } from "../dist/db/connection.js";
import { validarAmbienteColeta } from "../dist/config/env.js";
import { rodarCicloDeColeta } from "../dist/scheduler/cronJobs.js";
import { cronAutorizado } from "../dist/vercel/cronAuth.js";
import { logger } from "../dist/shared/logger.js";

let conectado = false;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ erro: "metodo_nao_permitido" });
    return;
  }

  if (!cronAutorizado(req.headers.authorization, req.query.secret)) {
    res.status(401).json({ erro: "nao_autorizado" });
    return;
  }

  try {
    validarAmbienteColeta();

    if (!conectado) {
      await connectDatabase();
      conectado = true;
    }

    logger.info("Cron de coleta disparado (Vercel)");
    await rodarCicloDeColeta();

    res.status(200).json({
      ok: true,
      horario: new Date().toISOString(),
    });
  } catch (erro) {
    logger.error({ erro }, "Falha no cron de coleta");
    res.status(500).json({
      ok: false,
      erro: "falha_coleta",
    });
  } finally {
    await disconnectDatabase().catch(() => undefined);
    conectado = false;
  }
}
