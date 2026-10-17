import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const html = readFileSync('tmp/listitem-0.html', 'utf8')
const { document } = parseHTML(html)

const allText = (document.body?.textContent || '').replace(/\s+/g, ' ').trim()
console.log('text snippet:', allText.slice(0, 400))

// All anchors
for (const a of [...document.querySelectorAll('a[href]')].slice(0, 30)) {
  console.log('A', a.getAttribute('href')?.slice(0, 120), '|', (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), '| aria', a.getAttribute('aria-label')?.slice(0, 80))
}

// Time-like elements
for (const sel of ['time', '[datetime]', 'span', 'p']) {
  // skip mass
}

const dates = [...html.matchAll(/\b\d{1,2} de (?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?(?:\s+de\s+\d{4})?\b/gi)]
console.log('dates in item', dates.map((d) => d[0]))

// Look for relative time like "1 sem", "2 d", "3 h"
const rel = [...html.matchAll(/\b(\d+\s*(?:min|h|d|sem|mês|mes|ano)s?)\b/gi)]
console.log('relative', rel.map((d) => d[0]).slice(0, 20))

// Find elements containing "de out"
const idx = html.indexOf('de out')
console.log('de out idx', idx)
if (idx >= 0) console.log(html.slice(idx - 300, idx + 120).replace(/\s+/g, ' '))

// media urls
const media = [...html.matchAll(/https:\/\/media\.licdn\.com\/[^"'\s]+/g)].map((m) => m[0])
console.log('media count', media.length, media.slice(0, 3))
