import { index, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  index('routes/_index.tsx'),
  route('scan', 'routes/scan.ts'),
  route('join', 'routes/join.ts'),
  route('counter', 'routes/counter.tsx'),
  // Source of the Open Graph image (public/og-image.png); not linked anywhere.
  route('og', 'routes/og.tsx'),
  // Passmint posts canonical pass.* lifecycle events here.
  route('api/webhooks/passmint', 'routes/api.webhooks.passmint.ts'),
] satisfies RouteConfig
