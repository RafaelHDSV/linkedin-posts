import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('tmp/activity.html', 'utf8')

const idx = html.indexOf('A IA responde bem')
console.log('idx', idx)
if (idx >= 0) {
  const slice = html.slice(Math.max(0, idx - 2500), idx + 2000)
  writeFileSync('tmp/slice-oct15.html', slice)
  const attrs = [...slice.matchAll(/data-[a-zA-Z0-9_-]+="[^"]{0,200}"/g)].map((m) => m[0]).slice(0, 50)
  console.log('nearby data attrs count', attrs.length)
  console.log(attrs.slice(0, 40))
  const classes = [...slice.matchAll(/class="([^"]{8,160})"/g)].map((m) => m[1]).slice(0, 40)
  console.log('nearby classes', classes)
}

for (const urn of [
  'urn:li:activity:7511455502107709440',
  'urn:li:activity:7503844754166607872',
]) {
  const i = html.indexOf(urn)
  console.log(urn, 'at', i)
  if (i >= 0) {
    const s = html.slice(Math.max(0, i - 400), i + 250).replace(/\s+/g, ' ')
    console.log(s.slice(0, 500))
    console.log('---')
  }
}

const patterns = {
  'feed-shared-update': /feed-shared-update/g,
  'update-components': /update-components/g,
  'occludable-update': /occludable-update/g,
  'data-id=': /data-id="/g,
  'data-chameleon-result-urn': /data-chameleon-result-urn/g,
  'activity:': /urn:li:activity:/g,
  'ugcPost:': /urn:li:ugcPost:/g,
  'share:': /urn:li:share:/g,
  fsd_update: /fsd_update/g,
  feedUpdate: /feedUpdate/g,
  componentkey: /componentkey/gi,
  'data-view-name': /data-view-name="/g,
  'aria-label activity': /aria-label="[^"]*atividade/gi,
}

for (const [name, p] of Object.entries(patterns)) {
  console.log(name, (html.match(p) || []).length)
}

const viewNames = [...new Set([...html.matchAll(/data-view-name="([^"]+)"/g)].map((m) => m[1]))]
console.log('viewNames', viewNames)

const activityAttrs = [...html.matchAll(/([a-zA-Z0-9_-]+="[^"]*urn:li:activity:[^"]+")/g)].map(
  (m) => m[1],
)
console.log('activity attrs', activityAttrs.slice(0, 40))

// Look for JSON blobs with posts
const codeBlocks = [...html.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/gi)]
console.log('code blocks', codeBlocks.length)
let jsonHits = 0
for (const block of codeBlocks.slice(0, 80)) {
  const raw = block[1]
  if (raw.includes('urn:li:activity') || raw.includes('commentary') || raw.includes('updateV2')) {
    jsonHits++
    if (jsonHits <= 3) {
      writeFileSync(`tmp/code-block-${jsonHits}.txt`, raw.slice(0, 5000))
    }
  }
}
console.log('interesting code blocks', jsonHits)

// Relative dates / absolute dates near posts
const dateHits = [...html.matchAll(/\b(\d{1,2} de (?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?)\b/gi)]
console.log('date hits', dateHits.slice(0, 20).map((m) => m[0]))
