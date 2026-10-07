export type Device = 'ios' | 'android' | 'desktop'

// Coarse: only picks the wallet badge and whether this screen is the phone or
// the laptop. iPads report as Macs and land on 'desktop', which is fine.
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
