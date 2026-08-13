export type NavigationDisposition = 'internal' | 'external' | 'blocked'

export function isTrustedHarnessUrl(
  candidate: string,
  harnessOrigin: string
): boolean {
  try {
    return new URL(candidate).origin === new URL(harnessOrigin).origin
  } catch {
    return false
  }
}

export function classifyNavigation(
  candidate: string,
  harnessOrigin: string
): NavigationDisposition {
  if (isTrustedHarnessUrl(candidate, harnessOrigin)) return 'internal'

  try {
    const url = new URL(candidate)
    if (url.protocol === 'https:') return 'external'
  } catch {
    // Invalid URLs are blocked below.
  }

  return 'blocked'
}
