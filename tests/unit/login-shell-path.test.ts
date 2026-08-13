import { describe, expect, it } from 'vitest'

import {
  extractPathFromNullEnvironment,
  normalizePath
} from '../../src/main/login-shell-path'

describe('login shell PATH utilities', () => {
  it('extracts the final PATH entry from null-separated output', () => {
    expect(
      extractPathFromNullEnvironment(
        'shell startup noise\n\0PATH=/usr/bin:/bin\0HOME=/tmp\0PATH=/opt/homebrew/bin:/usr/bin\0'
      )
    ).toBe('/opt/homebrew/bin:/usr/bin')
  })

  it('merges paths in priority order without duplicates', () => {
    expect(normalizePath('/custom:/usr/bin', '/usr/bin:/bin')).toBe(
      '/custom:/usr/bin:/bin'
    )
  })
})
