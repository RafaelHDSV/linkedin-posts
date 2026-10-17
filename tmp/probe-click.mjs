import { writeFileSync } from 'node:fs'
import { launchBrowser, createContext } from '../src/scraper/browser.ts'
import { ensureValidSession } from '../src/scraper/session.ts'

await ensureValidSession()
const browser = await launchBrowser(false) // headed may help; fall back headless via env
try {
  const context = await createContext(browser, { comSessao: true })
  const page = await context.newPage()
  await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(4000)

  const items = page.locator('[role="listitem"]')
  const count = await items.count()
  console.log('listitems', count)

  const results = []
  for (let i = 0; i < Math.min(count, 5); i++) {
    const item = items.nth(i)
    const texto = (
      await item.locator('[data-testid="expandable-text-box"]').first().textContent().catch(() => '')
    )
      ?.replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)

    // Prefer explicit feed/update link
    const update = item.locator('a[href*="/feed/update/"]')
    if ((await update.count()) > 0) {
      const href = await update.first().getAttribute('href')
      results.push({ i, texto, method: 'href', href })
      console.log(i, 'href', href, texto)
      continue
    }

    // Date sits in a <p><span>DD de mon.</span></p> — sibling/nearby <a tabindex=0> may be the card link
    const dateP = item.locator('p').filter({ hasText: /\d{1,2} de \w+/i }).first()
    const dateText = await dateP.textContent().catch(() => null)
    // Try clicking the overlay anchor near the actor header
    const overlay = item.locator('a[tabindex="0"]').first()
    const overlayHref = await overlay.getAttribute('href').catch(() => null)
    console.log(i, 'date', dateText, 'overlayHref', overlayHref)

    if ((await overlay.count()) > 0) {
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
        overlay.click({ timeout: 5000 }).catch((e) => ({ error: String(e) })),
      ])
      await page.waitForTimeout(2000)
      const url = popup ? popup.url() : page.url()
      results.push({ i, texto, method: 'click-overlay', url, dateText, overlayHref })
      console.log(i, 'after click', url)
      if (popup) await popup.close().catch(() => undefined)
      // navigate back if needed
      if (!page.url().includes('recent-activity')) {
        await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        })
        await page.waitForTimeout(3000)
      }
    }
  }

  writeFileSync('tmp/click-results.json', JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
