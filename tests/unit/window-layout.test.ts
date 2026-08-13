import { describe, expect, it } from 'vitest'

import { TOOLBAR_HEIGHT } from '../../src/shared/contracts'
import { calculateHarnessBounds } from '../../src/main/window-layout'

describe('Harness view layout', () => {
  it('reserves the persistent desktop toolbar', () => {
    expect(calculateHarnessBounds({ width: 1200, height: 800 })).toEqual({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width: 1200,
      height: 800 - TOOLBAR_HEIGHT
    })
  })

  it('never returns negative view dimensions', () => {
    expect(calculateHarnessBounds({ width: -10, height: 20 })).toMatchObject({
      width: 0,
      height: 0
    })
  })
})
