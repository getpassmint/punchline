import { cloudflareContext } from '../context'
import { logEvent } from '../lib/events.server'
import { PassmintError, verifyWebhookEvent } from '../lib/passmint.server'
import type { Route } from './+types/api.webhooks.passmint'

// Passmint's canonical lifecycle events land here (pass.added_to_wallet,
// pass.update_delivered, pass.removed, …). We verify and log them. Register
// the endpoint once with `passmint.webhooks.create` and store its secret as
// PASSMINT_WEBHOOK_SECRET — see the README "Lifecycle events" section.
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext)
  const secret = env.PASSMINT_WEBHOOK_SECRET

  if (!secret) {
    return new Response('PASSMINT_WEBHOOK_SECRET is not configured', {
      status: 503,
    })
  }

  try {
    const event = await verifyWebhookEvent(env, request, secret)

    logEvent('passmint', event.type, {
      passId: event.data.object.pass.id,
      platform: event.source.platform,
      livemode: event.livemode,
    })
  } catch (err) {
    // A non-2xx isn't fatal — Passmint retries failed deliveries with backoff.
    if (err instanceof PassmintError) {
      return new Response('invalid signature', { status: 400 })
    }

    throw err
  }

  return new Response(null, { status: 204 })
}
