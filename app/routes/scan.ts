import { isbot } from 'isbot'
import { data, redirect } from 'react-router'
import { cloudflareContext } from '../context'
import { completeIssue, startCard } from '../lib/loyalty.server'
import { setupProblem } from '../lib/passmint.server'
import { isSessionId, readSession, serializeSession } from '../lib/session.server'
import type { Route } from './+types/scan'

// The QR's target. Creates a card and redirects home at once; the pass is
// issued in the background. `?s=` carries the laptop's session so the phone
// joins it and both screens show the same card. Links here need
// `reloadDocument`, since the route has no page of its own.
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext)

  // A GET that mints a real pass: keep crawlers and link unfurlers out.
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

  const card = await startCard(env, sessionId)

  ctx.waitUntil(completeIssue(env, card.id))

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}
