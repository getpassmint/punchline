export type Device = 'ios' | 'android' | 'desktop'

// Coarse, and only used to pick which wallet badge to show and whether this
// screen is the phone or the laptop in the pairing. iPadOS claims to be a
// Mac, so an iPad lands on 'desktop' — it still gets the Apple badge.
export function detectDevice(userAgent: string | null): Device {
  if (!userAgent) {
    return 'desktop'
  }

  if (/iPhone|iPod|iPad/.test(userAgent)) {
    return 'ios'
  }

  if (/Android/.test(userAgent)) {
    return 'android'
  }

  return 'desktop'
}
