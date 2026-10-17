import { launchBrowser, createContext } from '../src/scraper/browser.ts'
import { ensureValidSession } from '../src/scraper/session.ts'

await ensureValidSession()
const browser = await launchBrowser()
try {
  const context = await createContext(browser, { comSessao: true })
  const page = await context.newPage()
  await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(4000)

  const item = page.locator('[role="listitem"]').first()
  const texto = (await item.locator('[data-testid="expandable-text-box"]').textContent())
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  console.log('texto', texto)

  const menuBtn = item.locator('button[aria-label*="menu de controle da publicação"]')
  console.log('menu count', await menuBtn.count())
  await menuBtn.click()
  await page.waitForTimeout(1500)

  // Dump visible menu items
  const items = await page.locator('[role="menu"] [role="menuitem"], [role="menuitem"], div[role="button"]').allTextContents()
  console.log('menu-ish texts', items.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30))

  // Try common copy-link labels
  const copy = page
    .locator('div,button,span')
    .filter({ hasText: /copiar link|copy link|Copiar link da publicação/i })
    .first()
  console.log('copy visible', await copy.isVisible().catch(() => false))
  if (await copy.isVisible().catch(() => false)) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await copy.click()
    await page.waitForTimeout(1000)
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => String(e))
    console.log('clipboard', clip)
  }

  // Also dump page HTML of open menus
  const menus = await page.locator('[role="menu"], .artdeco-dropdown__content, [data-test-menu]').count()
  console.log('menus', menus)
} finally {
  await browser.close()
}
