import { cloudflareContext } from '../context'
import { logEvent } from '../lib/events.server'
import { recordWalletEvent } from '../lib/loyalty.server'
import { PassmintError, type PassmintEvent, verifyWebhookEvent } from '../lib/passmint.server'
import type { Route } from './+types/api.webhooks.passmint'

// Passmint's lifecycle events (pass.added_to_wallet, pass.update_delivered,
// pass.removed, …). Verified, logged, and folded into the card's wallet
// status. Register with `passmint.webhooks.create` and store the secret as
// PASSMINT_WEBHOOK_SECRET.
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext)
  const secret = env.PASSMINT_WEBHOOK_SECRET

  if (!secret) {
    return new Response('PASSMINT_WEBHOOK_SECRET is not configured', {
      status: 503,
    })
  }

  let event: PassmintEvent

  try {
    event = await verifyWebhookEvent(env, request, secret)
  } catch (err) {
    // Passmint retries failed deliveries, so a 400 isn't fatal.
    if (err instanceof PassmintError) {
      return new Response('invalid signature', { status: 400 })
    }

    throw err
  }

  logEvent('passmint', event.type, {
    passId: event.data.object.pass.id,
    platform: event.source.platform,
    livemode: event.livemode,
  })

  await recordWalletEvent(env, event)

  return new Response(null, { status: 204 })
}
