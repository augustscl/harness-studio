import { describe, expect, it } from 'vitest'

import { ReadyUrlParser } from '../../src/main/ready-url-parser'

describe('ReadyUrlParser', () => {
  it('extracts the official ready line across stream chunks', () => {
    const parser = new ReadyUrlParser()
    expect(parser.push('noise\ndsh web: http://127.')).toBeUndefined()
    expect(parser.push('0.0.1:43821\r\nmore')).toBe(
      'http://127.0.0.1:43821'
    )
  })

  it('rejects deceptive or externally bound URLs', () => {
    const parser = new ReadyUrlParser()
    expect(parser.push('dsh web: http://0.0.0.0:3000\n')).toBeUndefined()
    expect(
      parser.push('dsh web: http://127.0.0.1.example.com:3000\n')
    ).toBeUndefined()
    expect(parser.push('dsh web: https://127.0.0.1:3000\n')).toBeUndefined()
  })

  it('rejects invalid ports and unrelated output', () => {
    const parser = new ReadyUrlParser()
    expect(parser.push('dsh web: http://127.0.0.1:0\n')).toBeUndefined()
    expect(parser.push('dsh web: http://127.0.0.1:99999\n')).toBeUndefined()
    expect(parser.finish()).toBeUndefined()
  })
})
