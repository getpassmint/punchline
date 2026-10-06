import {
  type Pass,
  Passmint,
  PassmintAPIError,
  PassmintAuthError,
  type PassmintEvent,
  PassmintRateLimitError,
} from '@passmint/node'

// Every Passmint call the app makes lives in this file. The pass template
// (design, fields, certificates, wallet delivery) lives on the Passmint
// platform; this app only owns the dynamic state — the stamp count — and
// pushes it onto the template's fields.
export type { PassmintEvent, PassmintEventType } from '@passmint/node'

export { PassmintError } from '@passmint/node'

import { logEvent } from './events.server'
import { type CardState, REWARD_AT, STAMP_GOAL } from './rules'

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
        ? 'Free coffee: show this at the counter'
        : `${REWARD_AT - stampCount} more for a free coffee`,
  }
}

// What's missing before the app can talk to Passmint, or null when it's
// ready. Shown on the landing page instead of a crash on first run.
export function setupProblem(env: Env): string | null {
  if (!env.PASSMINT_API_KEY) {
    return 'PASSMINT_API_KEY is not set. Add it to .dev.vars, or run `wrangler secret put` in production.'
  }

  if (!env.PASSMINT_TEMPLATE_ID?.startsWith('tmpl_')) {
    return 'PASSMINT_TEMPLATE_ID is not set. Point it at a loyalty template (tmpl_…).'
  }

  return null
}

// A sentence a visitor can read, for errors worth showing in the UI. Anything
// else (network failures, bugs) returns null and should propagate.
export function describePassmintError(err: unknown): string | null {
  if (err instanceof PassmintRateLimitError) {
    return 'Passmint is rate limiting this demo. Give it a few seconds and try again.'
  }

  if (err instanceof PassmintAuthError) {
    return 'Passmint rejected the API key. Check PASSMINT_API_KEY.'
  }

  if (err instanceof PassmintAPIError) {
    return `Passmint rejected the request: ${err.message}`
  }

  return null
}

// The strip art for a punch count: one of the template's image variants,
// uploaded by scripts/setup-pass.tsx ("0"…"9", where "9" is the reward).
// Off unless PASSMINT_STRIP_VARIANTS is "on".
function stripVariant(env: Env, stampCount: number): string | undefined {
  return env.PASSMINT_STRIP_VARIANTS === 'on' ? String(stampCount) : undefined
}

// Passmint rejects a variant the template doesn't have. A fork that hasn't
// run `pnpm setup:pass` yet would otherwise fail every punch, so retry once
// without the strip art: the pass still updates, just without it.
async function withStripFallback<T>(
  variant: string | undefined,
  send: (variant: string | undefined) => Promise<T>,
): Promise<T> {
  try {
    return await send(variant)
  } catch (err) {
    if (
      variant !== undefined &&
      err instanceof PassmintAPIError &&
      err.code === 'unknown_image_variant'
    ) {
      logEvent('punchline', 'pass.strip_variant_missing', { variant })

      return send(undefined)
    }

    throw err
  }
}

// One call issues a pass. The returned `url` is Passmint's hosted
// add-to-wallet page — it handles Apple/Google detection and delivery, so
// this app needs no wallet callback routes of its own.
export async function issuePass(env: Env): Promise<Pass & { warnings: string[] }> {
  return withStripFallback(stripVariant(env, 0), (imageVariant) =>
    client(env).passes.create({
      templateId: env.PASSMINT_TEMPLATE_ID,
      fieldValues: loyaltyFieldValues(0, 'active'),
      imageVariant,
      metadata: { app: 'punchline' },
    }),
  )
}

// The money moment: new field values (and the matching strip art) make
// Passmint re-sign the pass and push it to the wallet (APNs on Apple, an
// object patch on Google) — no push code or certificates on this side.
export async function pushLoyaltyState(
  env: Env,
  passId: string,
  stampCount: number,
  state: CardState,
): Promise<Pass> {
  return withStripFallback(stripVariant(env, stampCount), (imageVariant) =>
    client(env).passes.update(passId, {
      fieldValues: loyaltyFieldValues(stampCount, state),
      imageVariant,
    }),
  )
}

// Voiding marks the pass as no longer valid in the wallet and stops it
// counting against the plan's active passes. Used when a card is replaced
// or expires — see loyalty.server.ts.
export async function voidPass(env: Env, passId: string): Promise<void> {
  await client(env).passes.void(passId)
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
