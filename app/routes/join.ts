import { redirect } from 'react-router'
import { isSessionId, serializeSession } from '../lib/session.server'
import type { Route } from './+types/join'

// Target of the "add it to your phone" QR. Unlike /scan it issues nothing:
// the phone joins the laptop's session and opens its card.
export async function loader({ request }: Route.LoaderArgs) {
  const sessionId = new URL(request.url).searchParams.get('s')

  if (!isSessionId(sessionId)) {
    throw redirect('/')
  }

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}
