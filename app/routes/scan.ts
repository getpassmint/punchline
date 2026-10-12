import { isbot } from 'isbot'
import { data, redirect } from 'react-router'
import { cloudflareContext } from '../context'
import { completeIssue, startCard } from '../lib/loyalty.server'
import { setupProblem } from '../lib/passmint.server'
import { isSessionId, readSession, serializeSession } from '../lib/session.server'
import type { Route } from './+types/scan'

// The QR's target. A GET issues nothing: crawlers, link unfurlers and scripts
// fetch URLs all day, and each issue mints a real pass. It only carries the
// laptop's session (`?s=`) to the phone, whose page then offers the button.
export async function loader({ request }: Route.LoaderArgs) {
  const sessionId = new URL(request.url).searchParams.get('s')

  if (!isSessionId(sessionId)) {
    throw redirect('/')
  }

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}

// The "Get your punch card" button. Creates a card and redirects home at once;
// the pass is issued in the background. Forms posting here need
// `reloadDocument`, since the route has no page of its own.
export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext)

  // Browsers send Origin on every POST; anything else isn't the button.
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    isbot(request.headers.get('user-agent'))
  ) {
    throw data('Use the button on the page to get a card.', { status: 403 })
  }

  const problem = setupProblem(env)

  if (problem) {
    throw data(problem, { status: 503 })
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  const { success } = await env.SCAN_LIMITER.limit({ key: ip })

  if (!success) {
    throw data('Too many cards from here. Wait a minute and try again.', { status: 429 })
  }

  const sessionId = (await readSession(request)) ?? crypto.randomUUID()
  const card = await startCard(env, sessionId)

  ctx.waitUntil(completeIssue(env, card.id))

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}
