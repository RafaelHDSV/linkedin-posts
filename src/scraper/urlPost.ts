/**
 * URL de post aceita no cache: feed/update canonico ou short link lnkd.in.
 */
export function ehUrlPostUtilizavel(url: string | null | undefined): boolean {
  const limpa = (url ?? "").trim();
  if (!limpa) return false;

  let parsed: URL;
  try {
    parsed = new URL(limpa);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (host === "lnkd.in" || host.endsWith(".lnkd.in")) return true;
  if (host === "www.linkedin.com" || host === "linkedin.com") {
    return parsed.pathname.includes("/feed/update/");
  }
  return false;
}
