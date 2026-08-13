import { TOOLBAR_HEIGHT } from '../shared/contracts'

export interface WindowSize {
  width: number
  height: number
}

export interface ViewBounds extends WindowSize {
  x: number
  y: number
}

export function calculateHarnessBounds(size: WindowSize): ViewBounds {
  return {
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: Math.max(0, Math.floor(size.width)),
    height: Math.max(0, Math.floor(size.height) - TOOLBAR_HEIGHT)
  }
}
