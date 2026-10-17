import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const html = readFileSync('tmp/activity.html', 'utf8')
const { document } = parseHTML(html)

const items = [...document.querySelectorAll('[role="listitem"]')]
console.log('listitems', items.length)

for (const [i, item] of items.slice(0, 8).entries()) {
  const textBox = item.querySelector('[data-testid="expandable-text-box"]')
  const texto = (textBox?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)
  const hrefs = [...item.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href'))
    .filter(Boolean)
  const interesting = hrefs.filter(
    (h) =>
      h.includes('activity') ||
      h.includes('/posts/') ||
      h.includes('ugcPost') ||
      h.includes('share') ||
      h.includes('update') ||
      h.includes('recent-activity'),
  )
  const buttons = [...item.querySelectorAll('button[aria-label]')]
    .map((b) => b.getAttribute('aria-label'))
    .slice(0, 5)
  const componentkeys = [...item.querySelectorAll('[componentkey]')]
    .map((el) => el.getAttribute('componentkey'))
    .filter((k) => k && (k.includes('urn') || k.includes('activity') || k.length < 80))
    .slice(0, 10)
  const allKeys = [...item.querySelectorAll('[componentkey]')]
    .map((el) => el.getAttribute('componentkey'))
    .slice(0, 8)

  console.log('\n=== item', i, '===')
  console.log('texto:', texto)
  console.log('interesting hrefs:', interesting)
  console.log('buttons:', buttons)
  console.log('keys with urn-ish:', componentkeys)
  console.log('first keys:', allKeys)
  console.log('outerHTML len', item.outerHTML.length)

  if (i === 0) writeFileSync('tmp/listitem-0.html', item.outerHTML)
  if (texto.includes('IA responde')) writeFileSync('tmp/listitem-oct15.html', item.outerHTML)
}

// Search for any urn patterns beyond activity in listitems
const urns = [...html.matchAll(/urn:li:[a-zA-Z]+:[0-9]+/g)].map((m) => m[0])
const byType = {}
for (const u of urns) {
  const t = u.split(':').slice(0, 3).join(':')
  byType[t] = (byType[t] || 0) + 1
}
console.log('\nall urn types', byType)

// Look for /posts/ username URLs
const postUrls = [...new Set([...html.matchAll(/https:\/\/www\.linkedin\.com\/posts\/[^"'\s]+/g)].map((m) => m[0]))]
console.log('posts/ urls', postUrls.length, postUrls.slice(0, 10))

// Look for activity IDs in other formats (fsd, encoded)
const activityNums = [...html.matchAll(/activity[:%-](\d{15,20})/g)].map((m) => m[1])
console.log('activity nums', [...new Set(activityNums)].slice(0, 20))

// Check if Voyager/GraphQL payloads are in script tags
const scripts = [...document.querySelectorAll('script')]
console.log('scripts', scripts.length)
let withActivity = 0
for (const s of scripts) {
  const t = s.textContent || ''
  if (t.includes('urn:li:activity') || t.includes('updateV2') || t.includes('feedUpdate')) {
    withActivity++
    if (withActivity === 1) writeFileSync('tmp/script-activity.js', t.slice(0, 20000))
  }
}
console.log('scripts with activity', withActivity)
