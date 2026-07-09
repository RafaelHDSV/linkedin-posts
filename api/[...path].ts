import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApp } from "../dist/vercel/app.js";

/** Remove prefixo /api injetado pelos rewrites da Vercel antes de delegar ao Fastify. */
function normalizarUrl(req: VercelRequest): void {
  if (!req.url) return;
  const [pathname, search = ""] = req.url.split("?");
  const semApi = pathname.replace(/^\/api/, "") || "/";
  req.url = search ? `${semApi}?${search}` : semApi;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  normalizarUrl(req);
  const app = await getApp();
  app.server.emit("request", req, res);
}
