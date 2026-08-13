import { describe, expect, it } from 'vitest'

import { assertTrustedIpcSender } from '../../src/main/ipc-policy'

describe('IPC sender policy', () => {
  it('accepts only the desktop shell web contents', () => {
    expect(() => assertTrustedIpcSender(7, 7)).not.toThrow()
    expect(() => assertTrustedIpcSender(8, 7)).toThrow(/untrusted/u)
    expect(() => assertTrustedIpcSender(7, undefined)).toThrow(/untrusted/u)
  })
})
