import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { launchBrowser, createContext } from '../src/scraper/browser.ts'
import { ensureValidSession } from '../src/scraper/session.ts'

function decodeActivityFromCgs(id) {
  const prefix = id.split('-replaceable')[0]
  if (!prefix.startsWith('Cgs') && !prefix.startsWith('Cgo')) return null
  const buf = Buffer.from(prefix, 'base64')
  if (buf.length < 4 || buf[0] !== 0x0a) return null
  const len = buf[1]
  const inner = buf.subarray(2, 2 + len)
  if (inner[0] !== 0x08) return null
  let result = 0n
  let shift = 0n
  for (let i = 1; i < inner.length; i++) {
    const b = BigInt(inner[i])
    result |= (b & 0x7fn) << shift
    if ((b & 0x80n) === 0n) return result.toString()
    shift += 7n
  }
  return null
}

const html = readFileSync('tmp/activity.html', 'utf8')
const { document } = parseHTML(html)
const items = [...document.querySelectorAll('[role="listitem"]')]

console.log('--- static parse ---')
for (const [i, item] of items.entries()) {
  const authorBtn = item.querySelector('button[aria-label*="menu de controle da publicação"]')
  const author = authorBtn?.getAttribute('aria-label') || ''
  if (!/Rafael Vieira/i.test(author)) continue
  const texto = (item.querySelector('[data-testid="expandable-text-box"]')?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
  const href = item.querySelector('a[href*="/feed/update/"]')?.getAttribute('href')
  const cgs = [...item.outerHTML.matchAll(/\b(Cg[so]I[A-Za-z0-9+/=]{6,})\b/g)].map((m) => m[1])
  const decoded = cgs.map(decodeActivityFromCgs).filter(Boolean)
  const date = item.outerHTML.match(/\b\d{1,2} de (?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?/i)?.[0]
  console.log(i, { date, href: href?.slice(0, 70), decoded, texto })
}

// Live: copy link for first 3 author posts without href
console.log('\n--- live copy link ---')
await ensureValidSession()
const browser = await launchBrowser()
try {
  const context = await createContext(browser, { comSessao: true })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(4000)

  const results = []
  const liveItems = page.locator('[role="listitem"]')
  const count = await liveItems.count()
  for (let i = 0; i < Math.min(count, 6); i++) {
    const item = liveItems.nth(i)
    const aria = await item.locator('button[aria-label*="menu de controle da publicação"]').getAttribute('aria-label').catch(() => '')
    if (!/Rafael Vieira/i.test(aria || '')) continue
    const hasUpdate = (await item.locator('a[href*="/feed/update/"]').count()) > 0
    if (hasUpdate) {
      const href = await item.locator('a[href*="/feed/update/"]').first().getAttribute('href')
      results.push({ i, method: 'href', href })
      continue
    }
    await item.locator('button[aria-label*="menu de controle da publicação"]').click()
    await page.waitForTimeout(800)
    const copy = page.getByText('Copiar link da publicação', { exact: true })
    if (!(await copy.isVisible().catch(() => false))) {
      results.push({ i, method: 'copy', error: 'menu item missing' })
      await page.keyboard.press('Escape')
      continue
    }
    await copy.click()
    await page.waitForTimeout(500)
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `err:${e}`)
    results.push({ i, method: 'copy', clip })
    await page.keyboard.press('Escape').catch(() => undefined)
    await page.waitForTimeout(400)
  }
  writeFileSync('tmp/copy-link-results.json', JSON.stringify(results, null, 2))
  console.log(results)
} finally {
  await browser.close()
}
