import { isbot } from 'isbot'
import { data, redirect } from 'react-router'
import { cloudflareContext } from '../context'
import { completeIssue, startCard } from '../lib/loyalty.server'
import { setupProblem } from '../lib/passmint.server'
import { isSessionId, readSession, serializeSession } from '../lib/session.server'
import type { Route } from './+types/scan'

// The URL behind the landing-page QR. Each scan creates a card — no signup —
// and sends the phone home straight away, where the page shows the pass
// appearing as Passmint issues it. It has no page of its own, so links to it need
// `reloadDocument`: a client-side navigation never reaches the server.
//
// `?s=` carries the laptop's session id, so the phone joins it: the laptop
// (polling) picks up the same card and can stamp it while you watch the
// phone. Without it, the browser's own session is used, or a new one.
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext)

  // A GET that mints a real pass: keep link unfurlers and crawlers out.
  if (isbot(request.headers.get('user-agent'))) {
    throw redirect('/')
  }

  const problem = setupProblem(env)

  if (problem) {
    throw data(problem, { status: 503 })
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  const { success } = await env.SCAN_LIMITER.limit({ key: ip })

  if (!success) {
    throw data('Too many cards from here. Wait a minute and scan again.', { status: 429 })
  }

  const fromQr = new URL(request.url).searchParams.get('s')
  const sessionId = isSessionId(fromQr)
    ? fromQr
    : ((await readSession(request)) ?? crypto.randomUUID())

  // The card exists from here on; its pass is issued after the redirect has
  // gone (waitUntil keeps the Worker alive for it). The page shows a skeleton
  // until it lands, or Passmint's error with a retry button if it fails.
  const card = await startCard(env, sessionId)

  ctx.waitUntil(completeIssue(env, card.id))

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}
