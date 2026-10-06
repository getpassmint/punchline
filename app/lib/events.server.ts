import type { PassmintEventType } from './passmint.server'

// One JSON line per lifecycle transition — the demo's whole analytics story,
// readable with `wrangler tail`. The `punchline` source is this app's own
// transitions; `passmint` relays canonical events from the webhook receiver.
type AppEvent =
  | 'pass.issued'
  | 'pass.stamped'
  | 'pass.reward_earned'
  | 'pass.redeemed'
  | 'pass.retired'
  | 'pass.retire_failed'
  | 'pass.strip_variant_missing'
  | 'pass.issue_failed'

export function logEvent(
  source: 'punchline' | 'passmint',
  event: AppEvent | PassmintEventType,
  data: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ source, event, at: new Date().toISOString(), ...data }))
}
