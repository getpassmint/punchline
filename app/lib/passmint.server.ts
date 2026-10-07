import {
  type Pass,
  Passmint,
  PassmintAPIError,
  PassmintAuthError,
  type PassmintEvent,
  PassmintRateLimitError,
} from '@passmint/node'

// Every Passmint call lives in this file. The pass template (design, fields,
// certificates) lives on Passmint; the app only owns the punch count and
// pushes it onto the template's fields.
export type { PassmintEvent, PassmintEventType } from '@passmint/node'

export { PassmintError } from '@passmint/node'

import { logEvent } from './events.server'
import { type CardState, REWARD_AT, STAMP_GOAL } from './rules'

// Issuing runs under waitUntil, which Cloudflare stops after about 30s. One
// attempt plus a retry fits inside that, so a slow call fails visibly.
function client(env: Env): Passmint {
  return new Passmint({ apiKey: env.PASSMINT_API_KEY, timeoutMs: 12_000, maxRetries: 1 })
}

// Card state as the template's field values (keys match Passmint's "Coffee
// Loyalty" starter; keys the template lacks are ignored).
function loyaltyFieldValues(stampCount: number, state: CardState): Record<string, string> {
  return {
    count: `${stampCount} / ${STAMP_GOAL}`,
    stamps: '●'.repeat(stampCount) + '○'.repeat(STAMP_GOAL - stampCount),
    nextReward:
      state === 'reward'
        ? 'Free coffee: show this at the counter'
        : `${REWARD_AT - stampCount} more for a free coffee`,
  }
}

// What's missing before the app can talk to Passmint, shown on the home
// page instead of a crash on first run.
export function setupProblem(env: Env): string | null {
  if (!env.PASSMINT_API_KEY) {
    return 'PASSMINT_API_KEY is not set. Add it to .dev.vars, or run `wrangler secret put` in production.'
  }

  if (!env.PASSMINT_TEMPLATE_ID?.startsWith('tmpl_')) {
    return 'PASSMINT_TEMPLATE_ID is not set. Point it at a loyalty template (tmpl_…).'
  }

  return null
}

// Another attempt at the same issue is still running at Passmint.
export function isIssueInProgress(err: unknown): boolean {
  return (
    err instanceof PassmintAPIError &&
    err.type === 'idempotency_error' &&
    /still being processed/i.test(err.message)
  )
}

// A readable message for Passmint API errors; null for anything else, which
// should propagate.
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

// The strip art for a punch count: one of the template's image variants
// ("0"…"9"), uploaded by scripts/setup-pass.tsx.
function stripVariant(env: Env, stampCount: number): string | undefined {
  return env.PASSMINT_STRIP_VARIANTS === 'on' ? String(stampCount) : undefined
}

// Passmint rejects a variant the template doesn't have, so before
// `pnpm setup:pass` has run, retry without the strip art.
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

// One call issues a pass. Its `url` is Passmint's hosted add-to-wallet page,
// so the app needs no wallet callback routes of its own.
export async function issuePass(
  env: Env,
  idempotencyKey: string,
): Promise<Pass & { warnings: string[] }> {
  return withStripFallback(stripVariant(env, 0), (imageVariant) =>
    client(env).passes.create(
      {
        templateId: env.PASSMINT_TEMPLATE_ID,
        fieldValues: loyaltyFieldValues(0, 'active'),
        imageVariant,
        metadata: { app: 'punchline' },
      },
      // Shared by every run of one attempt, so Passmint returns one pass.
      { idempotencyKey: imageVariant === undefined ? `${idempotencyKey}:plain` : idempotencyKey },
    ),
  )
}

// New field values and strip art make Passmint re-sign the pass and push it
// to the phone (APNs on Apple, an object patch on Google).
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

// Voids a pass: it stays in the wallet, marked invalid, and stops counting
// against the plan's active passes.
export async function voidPass(env: Env, passId: string): Promise<void> {
  await client(env).passes.void(passId)
}

// Verifies the `passmint-signature` header and returns the event, or throws
// PassmintError. Needs the nodejs_compat flag (node:crypto).
export async function verifyWebhookEvent(
  env: Env,
  request: Request,
  secret: string,
): Promise<PassmintEvent> {
  const payload = await request.text()
  const signature = request.headers.get('passmint-signature') ?? ''

  return client(env).webhooks.constructEvent(payload, signature, secret)
}
