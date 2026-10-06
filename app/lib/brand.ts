// Punchline's colours, shared by the web page, the strip art and the pass
// template (scripts/setup-pass.tsx), so the replica on the page and the pass
// in the wallet can't drift apart. Mirrored as CSS tokens in app.css.
export const BRAND = {
  name: 'Punchline',
  cobalt: '#2340D8',
  cobaltDeep: '#1A31A8',
  butter: '#F7D046',
  butterDeep: '#D8AE1F',
  ink: '#0E1A4D',
  white: '#FFFFFF',
} as const
