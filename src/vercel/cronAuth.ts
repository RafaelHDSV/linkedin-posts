import { env } from "../config/env.js";

export function cronAutorizado(authorization: string | undefined, secretQuery?: string | string[]): boolean {
  if (!env.cronSecret) return false;

  if (authorization === `Bearer ${env.cronSecret}`) return true;

  const query = Array.isArray(secretQuery) ? secretQuery[0] : secretQuery;
  return query === env.cronSecret;
}
