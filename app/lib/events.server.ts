import type { PassmintEventType } from './passmint.server'

// One JSON log line per event, readable with `wrangler tail`. `punchline` is
// the app's own; `passmint` relays webhook events.
type AppEvent =
  | 'pass.issued'
  | 'pass.issue_failed'
  | 'pass.punched'
  | 'pass.reward'
  | 'pass.redeemed'
  | 'pass.retired'
  | 'pass.retire_failed'
  | 'pass.strip_variant_missing'

export function logEvent(
  source: 'punchline' | 'passmint',
  event: AppEvent | PassmintEventType,
  data: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ source, event, at: new Date().toISOString(), ...data }))
}
