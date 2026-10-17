function decodeVarint(bytes, start = 0) {
  let result = 0n
  let shift = 0n
  let i = start
  while (i < bytes.length) {
    const b = BigInt(bytes[i])
    result |= (b & 0x7fn) << shift
    i++
    if ((b & 0x80n) === 0n) break
    shift += 7n
  }
  return { value: result, next: i }
}

const buf = Buffer.from('0a0b0880c0d4a4c1c589d0d001', 'hex')
console.log('bytes', [...buf])

// Parse outer length-delimited field 1
let i = 0
const tag = buf[i++]
const len = buf[i++]
console.log({ tag, len })
const inner = buf.subarray(i, i + len)
console.log('inner', [...inner])

let j = 0
while (j < inner.length) {
  const fieldTag = inner[j++]
  const field = fieldTag >> 3
  const wire = fieldTag & 7
  console.log({ field, wire })
  if (wire === 0) {
    const { value, next } = decodeVarint(inner, j)
    console.log('varint', value.toString(), 'as number check', value)
    // snowflake date
    try {
      const ms = Number(value >> 22n)
      console.log('snowflake date', new Date(ms).toISOString())
    } catch {}
    j = next
  } else if (wire === 2) {
    const { value: l, next } = decodeVarint(inner, j)
    j = next
    const payload = inner.subarray(j, j + Number(l))
    console.log('len delim', Number(l), payload.toString('utf8'), [...payload])
    j += Number(l)
  } else {
    console.log('unsupported wire', wire)
    break
  }
}

// Also verify known activity encodes similarly
const known = 7511455502107709440n
console.log('\nknown', known.toString())
console.log('known snowflake', new Date(Number(known >> 22n)).toISOString())

// Encode known as protobuf field1{ field1: varint }
function encodeVarint(n) {
  const out = []
  let x = BigInt(n)
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n))
    x >>= 7n
  }
  out.push(Number(x))
  return Buffer.from(out)
}
const enc = encodeVarint(known)
console.log('encoded known varint', enc.toString('hex'), Buffer.concat([Buffer.from([0x0a, enc.length + 1, 0x08]), enc]).toString('base64'))
