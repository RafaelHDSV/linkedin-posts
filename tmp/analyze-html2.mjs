import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

const html = readFileSync('tmp/activity.html', 'utf8')
const { document } = parseHTML(html)

// All feed/update links
const links = [...document.querySelectorAll('a[href*="/feed/update/"]')]
console.log('feed/update links', links.length)
for (const a of links.slice(0, 15)) {
  console.log('-', a.getAttribute('href'))
}

// expandable text boxes
const texts = [...document.querySelectorAll('[data-testid="expandable-text-box"]')]
console.log('expandable-text-box', texts.length)
for (const el of texts.slice(0, 8)) {
  const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  console.log('-', t)
}

// Find nearest feed/update ancestor/sibling for each text box via walking up
function findNearbyUpdateHref(el) {
  let node = el
  for (let i = 0; i < 12 && node; i++) {
    const a = node.querySelector?.('a[href*="/feed/update/"]')
    if (a) return a.getAttribute('href')
    const self = node.matches?.('a[href*="/feed/update/"]') ? node : null
    if (self) return self.getAttribute('href')
    // look at previous siblings
    let sib = node.previousElementSibling
    let steps = 0
    while (sib && steps < 8) {
      const found = sib.querySelector?.('a[href*="/feed/update/"]') || (sib.matches?.('a[href*="/feed/update/"]') ? sib : null)
      if (found) return found.getAttribute('href')
      sib = sib.previousElementSibling
      steps++
    }
    node = node.parentElement
  }
  return null
}

console.log('\ntext -> nearby href')
for (const el of texts.slice(0, 12)) {
  const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  console.log(findNearbyUpdateHref(el), '|', t)
}

// Count componentkey anchors that look like post cards
const componentKeys = [...document.querySelectorAll('[componentkey]')]
console.log('\ncomponentkey elements', componentKeys.length)

// Try to find articles / list items
for (const sel of ['article', 'li', '[role="listitem"]', '[role="article"]', 'main li', 'main article']) {
  console.log(sel, document.querySelectorAll(sel).length)
}

// Extract post cards by walking from each feed/update href upward to a container that includes text
const posts = []
const seen = new Set()
for (const a of links) {
  const href = a.getAttribute('href') || ''
  const m = href.match(/urn:li:activity:\d+/)
  if (!m || seen.has(m[0])) continue
  seen.add(m[0])

  let container = a
  let texto = ''
  for (let depth = 0; depth < 15 && container; depth++) {
    const box = container.querySelector?.('[data-testid="expandable-text-box"]')
    if (box?.textContent) {
      texto = box.textContent
      break
    }
    container = container.parentElement
  }
  posts.push({ urn: m[0], texto: texto.replace(/\s+/g, ' ').trim().slice(0, 100), href })
}
console.log('\nposts via link walk', posts.length)
console.log(posts)

// Check if Oct 15 text has any nearby /feed/update within 5k chars in raw HTML
const needle = 'A IA responde bem'
const i = html.indexOf(needle)
const window = html.slice(i - 8000, i + 8000)
const urnsNear = [...window.matchAll(/urn:li:activity:\d+/g)].map((x) => x[0])
const hrefsNear = [...window.matchAll(/href="([^"]*feed\/update[^"]*)"/g)].map((x) => x[1])
console.log('\nnear Oct15 urns', [...new Set(urnsNear)])
console.log('near Oct15 hrefs', [...new Set(hrefsNear)])
writeFileSync('tmp/window-oct15.html', window)
