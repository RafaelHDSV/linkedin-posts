import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const html = readFileSync('tmp/activity.html', 'utf8')
const { document } = parseHTML(html)
const items = [...document.querySelectorAll('[role="listitem"]')].filter((el) => {
  const a = el.querySelector('button[aria-label*="menu de controle da publica"]')
  return a && /Rafael Vieira/i.test(a.getAttribute('aria-label') || '')
}).slice(0, 4)

const body = items.map((i) => i.outerHTML).join('\n')
const doc = `<!DOCTYPE html><html><body><main>${body}</main></body></html>`
writeFileSync('tests/fixtures/activity-sdui-sample.html', doc)
console.log('bytes', doc.length, 'items', items.length)
for (const item of items) {
  const t = (item.querySelector('[data-testid="expandable-text-box"]')?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  console.log('-', t)
}
