import { describe, expect, it } from 'vitest'

import { LogBuffer } from '../../src/main/log-buffer'

describe('LogBuffer', () => {
  it('normalizes chunks and retains only the configured line tail', () => {
    const buffer = new LogBuffer(3)
    buffer.append('one\ntwo\n')
    buffer.append('three\nfour\n')

    expect(buffer.lines()).toEqual(['two', 'three', 'four'])
  })

  it('joins a line split across stream chunks', () => {
    const buffer = new LogBuffer(10)
    buffer.append('hel')
    buffer.append('lo\nworld')

    expect(buffer.lines()).toEqual(['hello', 'world'])
  })

  it('preserves a UTF-8 character split across byte chunks', () => {
    const buffer = new LogBuffer(10)
    const bytes = Buffer.from('你好\n')
    buffer.append(bytes.subarray(0, 2))
    buffer.append(bytes.subarray(2))

    expect(buffer.lines()).toEqual(['你好'])
  })
})
