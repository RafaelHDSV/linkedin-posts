import type { FastifyInstance } from "fastify";
import { buildServer } from "../api/server.js";
import { connectDatabase } from "../db/connection.js";

let app: FastifyInstance | null = null;
let conectado = false;

export async function getApp(): Promise<FastifyInstance> {
  if (!conectado) {
    await connectDatabase();
    conectado = true;
  }
  if (!app) {
    app = buildServer();
    await app.ready();
  }
  return app;
}
