import type { PassmintEventType } from './passmint.server'

// One JSON line per lifecycle transition — the demo's whole analytics story,
// readable with `wrangler tail`. The `tenthcup` source is this app's own
// transitions; `passmint` relays canonical events from the webhook receiver.
type TenthcupEvent = 'pass.issued' | 'pass.stamped' | 'pass.reward_earned' | 'pass.redeemed'

export function logEvent(
  source: 'tenthcup' | 'passmint',
  event: TenthcupEvent | PassmintEventType,
  data: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ source, event, at: new Date().toISOString(), ...data }))
}
