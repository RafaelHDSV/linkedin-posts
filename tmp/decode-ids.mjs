import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

function decodeVarints(buf) {
  const nums = []
  let i = 0
  while (i < buf.length) {
    let result = 0n
    let shift = 0n
    while (i < buf.length) {
      const b = BigInt(buf[i++])
      result |= (b & 0x7fn) << shift
      if ((b & 0x80n) === 0n) break
      shift += 7n
    }
    nums.push(result)
  }
  return nums
}

function tryDecodeActivity(id) {
  const normalized = id.replace(/-/g, '+').replace(/_/g, '/')
  let buf
  try {
    buf = Buffer.from(normalized, 'base64')
  } catch {
    return null
  }
  const varints = decodeVarints(buf)
  // activity snowflakes are ~19 digits
  const candidates = varints
    .map((n) => n.toString())
    .filter((s) => s.length >= 15 && s.length <= 20)
  return { hex: buf.toString('hex'), bytes: [...buf], candidates, varints: varints.map(String) }
}

const html = readFileSync('tmp/activity.html', 'utf8')
const { document } = parseHTML(html)
const items = [...document.querySelectorAll('[role="listitem"]')]

for (const [i, item] of items.slice(0, 8).entries()) {
  const texto = (item.querySelector('[data-testid="expandable-text-box"]')?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  const ck = item.getAttribute('componentkey') || ''
  const opaque = ck.match(/update-card-focus(.+?)FeedType_/)?.[1]
  const ids = [...item.outerHTML.matchAll(/\b(CgsI[A-Za-z0-9+/=_-]{6,})\b/g)].map((m) => m[1])
  const updateHref = item.querySelector('a[href*="/feed/update/"]')?.getAttribute('href')
  const known = updateHref?.match(/urn:li:activity:(\d+)/)?.[1]

  console.log('\n===', i, '===')
  console.log('texto', texto)
  console.log('opaque', opaque)
  console.log('known activity', known)
  console.log('CgsI', [...new Set(ids)])
  for (const id of [...new Set(ids)]) {
    console.log(' decode', id, tryDecodeActivity(id.split('-')[0] === 'CgsI' ? id.split('-replaceable')[0] : id))
  }
  // Also try decoding just the prefix before -replaceable
  for (const id of [...new Set(ids)]) {
    const prefix = id.split('-replaceable')[0]
    if (prefix !== id) console.log(' prefix decode', prefix, tryDecodeActivity(prefix))
  }
}
