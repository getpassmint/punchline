import { type Pass, Passmint, type PassmintEvent } from '@passmint/node'

// Every Passmint call the app makes lives in this file. The pass template
// (design, fields, certificates, wallet delivery) lives on the Passmint
// platform; this app only owns the dynamic state — the stamp count — and
// pushes it onto the template's fields.
export type { PassmintEventType } from '@passmint/node'

export { PassmintAPIError, PassmintError } from '@passmint/node'

/** Slots on the card. */
export const STAMP_GOAL = 10

/** The tenth cup is free, so the reward lands on the ninth paid stamp. */
export const REWARD_AT = STAMP_GOAL - 1

export type CardState = 'active' | 'reward'

function client(env: Env): Passmint {
  return new Passmint({ apiKey: env.PASSMINT_API_KEY })
}

// Maps card state onto the template's field keys (matching Passmint's
// "Coffee Loyalty" starter). Keys the template doesn't define are ignored.
export function loyaltyFieldValues(stampCount: number, state: CardState): Record<string, string> {
  return {
    count: `${stampCount} / ${STAMP_GOAL}`,
    stamps: '●'.repeat(stampCount) + '○'.repeat(STAMP_GOAL - stampCount),
    nextReward:
      state === 'reward'
        ? 'Free coffee — show this at the counter'
        : `${REWARD_AT - stampCount} more for a free coffee`,
  }
}

// One call issues a pass. The returned `url` is Passmint's hosted
// add-to-wallet page — it handles Apple/Google detection and delivery, so
// this app needs no wallet callback routes of its own.
export async function issuePass(env: Env): Promise<Pass & { warnings: string[] }> {
  return client(env).passes.create({
    templateId: env.PASSMINT_TEMPLATE_ID,
    fieldValues: loyaltyFieldValues(0, 'active'),
    metadata: { app: 'tenthcup' },
  })
}

// The money moment: updating field values makes Passmint re-sign the pass
// and push it to the wallet (empty APNs push on Apple, object patch on
// Google) — no push code or certificates on this side.
export async function pushLoyaltyState(
  env: Env,
  passId: string,
  stampCount: number,
  state: CardState,
): Promise<Pass> {
  return client(env).passes.update(passId, {
    fieldValues: loyaltyFieldValues(stampCount, state),
  })
}

// Verifies the `passmint-signature` HMAC and returns the typed event, or
// throws PassmintError. Uses node:crypto, so the Worker needs nodejs_compat.
export async function verifyWebhookEvent(
  env: Env,
  request: Request,
  secret: string,
): Promise<PassmintEvent> {
  const payload = await request.text()
  const signature = request.headers.get('passmint-signature') ?? ''

  return client(env).webhooks.constructEvent(payload, signature, secret)
}
