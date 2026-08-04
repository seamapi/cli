import { describe, expect, it } from 'vitest'

import { extractTarEntry } from './blueprint.js'

const createTarEntry = (name: string, content: Buffer): Buffer => {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  header.write('0000644\0', 100, 'utf8')
  header.write('0000000\0', 108, 'utf8')
  header.write('0000000\0', 116, 'utf8')
  header.write(`${content.length.toString(8).padStart(11, '0')}\0`, 124, 'utf8')
  header.write('00000000000\0', 136, 'utf8')
  header.write('        ', 148, 'utf8')
  header.write('0', 156, 'utf8')
  header.write('ustar\0', 257, 'utf8')
  header.write('00', 263, 'utf8')

  let checksum = 0
  for (const byte of header) checksum += byte
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'utf8')

  const data = Buffer.alloc(Math.ceil(content.length / 512) * 512)
  content.copy(data)

  return Buffer.concat([header, data])
}

const createTar = (entries: Array<[string, Buffer]>): Buffer =>
  Buffer.concat([
    ...entries.map(([name, content]) => createTarEntry(name, content)),
    Buffer.alloc(1024),
  ])

describe('extractTarEntry', () => {
  it('extracts the entry with the given name', () => {
    const content = Buffer.from('export default {}\n', 'utf8')
    const tar = createTar([
      ['package/package.json', Buffer.from('{}', 'utf8')],
      ['package/lib/seam/connect/openapi.js', content],
      ['package/index.js', Buffer.from('export {}\n', 'utf8')],
    ])

    const entry = extractTarEntry(tar, 'package/lib/seam/connect/openapi.js')

    expect(entry.equals(content)).toBe(true)
  })

  it('extracts an entry that is not a multiple of the block size', () => {
    const content = Buffer.alloc(700, 'a')
    const tar = createTar([['package/big.js', content]])

    const entry = extractTarEntry(tar, 'package/big.js')

    expect(entry.equals(content)).toBe(true)
  })

  it('throws when the entry is missing', () => {
    const tar = createTar([['package/package.json', Buffer.from('{}')]])

    expect(() => extractTarEntry(tar, 'package/missing.js')).toThrow(/missing/i)
  })
})
