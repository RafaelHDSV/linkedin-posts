import { launchBrowser, createContext } from '../src/scraper/browser.ts'
import { ensureValidSession } from '../src/scraper/session.ts'

const candidates = [
  'https://www.linkedin.com/feed/update/urn:li:activity:15033057526928449536/',
  'https://www.linkedin.com/feed/update/urn:li:ugcPost:15033057526928449536/',
  'https://www.linkedin.com/feed/update/urn:li:share:15033057526928449536/',
]

await ensureValidSession()
const browser = await launchBrowser()
try {
  const context = await createContext(browser, { comSessao: true })
  const page = await context.newPage()

  for (const url of candidates) {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch((e) => null)
    await page.waitForTimeout(2500)
    const finalUrl = page.url()
    const title = await page.title()
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ')
    console.log({ url, status: resp?.status(), finalUrl, title, body })
  }

  // Copy-link via overflow on first card
  await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(4000)
  const item = page.locator('[role="listitem"]').first()
  await item.locator('button[aria-label*="menu de controle da publicação"]').click()
  await page.waitForTimeout(2000)
  const texts = await page.evaluate(() =>
    [...document.querySelectorAll('div,span,button,a')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 2 && t.length < 80 && /link|copiar|copy|incorpor|embed|interess|salvar|denunciar|seguir/i.test(t)),
  )
  console.log('overlay candidates', [...new Set(texts)].slice(0, 40))
} finally {
  await browser.close()
}
