import { describe, expect, it } from 'vitest'

import {
  classifyNavigation,
  isTrustedHarnessUrl
} from '../../src/main/navigation-policy'

const origin = 'http://127.0.0.1:38491'

describe('navigation policy', () => {
  it('keeps same-origin Harness navigation in the embedded view', () => {
    expect(isTrustedHarnessUrl(`${origin}/sessions/abc`, origin)).toBe(true)
    expect(classifyNavigation(`${origin}/settings`, origin)).toBe('internal')
  })

  it('opens external HTTPS links in the system browser', () => {
    expect(classifyNavigation('https://docs.deepseek.com/guide', origin)).toBe(
      'external'
    )
  })

  it('blocks unsafe schemes and deceptive loopback hosts', () => {
    expect(classifyNavigation('file:///etc/passwd', origin)).toBe('blocked')
    expect(classifyNavigation('javascript:alert(1)', origin)).toBe('blocked')
    expect(
      classifyNavigation('http://127.0.0.1.example.com:38491', origin)
    ).toBe('blocked')
  })
})
