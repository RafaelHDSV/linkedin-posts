import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { parsearPostsDoHtml } from "../src/scraper/postParser.ts";

const html = readFileSync("tmp/activity.html", "utf8");
const agora = new Date("2026-11-05T08:45:46.400Z");
const posts = parsearPostsDoHtml(html, "rafael-vieira1720", { agora });
console.log("parsed", posts.length);
for (const p of posts.slice(0, 12)) {
  console.log(
    JSON.stringify({
      publicadoEm: p.publicadoEm,
      t: p.texto.slice(0, 40).replace(/\n/g, " "),
    }),
  );
}

const { document } = parseHTML(html);
const items = [...document.querySelectorAll('[role="listitem"]')];
for (const el of items) {
  const texto = el.querySelector("[data-testid='expandable-text-box']")?.textContent ?? "";
  if (!/Repo-Workspace|paleta e o tom|Pedi uma logo|PaaS no plano/i.test(texto)) continue;
  const full = el.outerHTML ?? "";
  const cab = full.split(/data-testid=["']expandable-text-box["']/i)[0] ?? "";
  const abs = [...cab.matchAll(/\b(\d{1,2}\s+de\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?)\b/gi)].map(
    (m) => m[1],
  );
  const rel = [
    ...cab.matchAll(
      /\b(\d+\s*(?:sem(?:ana)?s?|dias?|d|min(?:utos?)?|m[eê]s(?:es)?|anos?|horas?|hrs?|h)|agora(?:\s+mesmo)?)\b/gi,
    ),
  ].map((m) => m[1]);
  const absFull = [
    ...full.matchAll(/\b(\d{1,2}\s+de\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?)\b/gi),
  ].map((m) => m[1]);
  const relFull = [
    ...full.matchAll(
      /\b(\d+\s*(?:sem(?:ana)?s?|dias?|d|min(?:utos?)?|m[eê]s(?:es)?|anos?|horas?|hrs?|h)|agora(?:\s+mesmo)?)\b/gi,
    ),
  ].map((m) => m[1]);
  console.log("CARD", texto.slice(0, 40).replace(/\n/g, " "));
  console.log("  cab abs", abs, "cab rel", rel);
  console.log("  full abs", absFull.slice(0, 6), "full rel", relFull.slice(0, 10));
}
