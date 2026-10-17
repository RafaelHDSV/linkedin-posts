import { writeFileSync, mkdirSync } from 'node:fs'
import { launchBrowser, createContext } from '../src/scraper/browser.ts'
import { ensureValidSession } from '../src/scraper/session.ts'

mkdirSync('tmp/network', { recursive: true })

const sessao = await ensureValidSession()
console.log('sessao', sessao)

const browser = await launchBrowser()
const hits = []

try {
  const context = await createContext(browser, { comSessao: true })
  const page = await context.newPage()

  page.on('response', async (response) => {
    try {
      const url = response.url()
      const ct = response.headers()['content-type'] || ''
      if (!ct.includes('json') && !ct.includes('graphql') && !url.includes('graphql') && !url.includes('voyager')) {
        return
      }
      const status = response.status()
      if (status < 200 || status >= 300) return
      const text = await response.text()
      if (!text.includes('activity') && !text.includes('ugcPost') && !text.includes('commentary')) return
      const file = `tmp/network/${hits.length}-${Buffer.from(url).toString('base64url').slice(0, 40)}.json`
      writeFileSync(file, text.slice(0, 2_000_000))
      hits.push({ url: url.slice(0, 180), status, len: text.length, file, activityCount: (text.match(/urn:li:activity:\d+/g) || []).length })
      console.log('HIT', hits.length, hits.at(-1))
    } catch {
      // ignore closed responses
    }
  })

  await page.goto('https://www.linkedin.com/in/rafael-vieira1720/recent-activity/all/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForTimeout(6000)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2400)
    await page.waitForTimeout(1800)
  }
  await page.waitForTimeout(3000)
} finally {
  await browser.close()
}

writeFileSync('tmp/network-hits.json', JSON.stringify(hits, null, 2))
console.log('total hits', hits.length)
