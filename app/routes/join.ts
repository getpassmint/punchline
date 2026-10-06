import { redirect } from 'react-router'
import { isSessionId, serializeSession } from '../lib/session.server'
import type { Route } from './+types/join'

// The "add it to your phone" QR beside an existing card. Unlike /scan it
// issues nothing: the phone just joins the laptop's session, lands on that
// card, and adds it to its wallet from there.
export async function loader({ request }: Route.LoaderArgs) {
  const sessionId = new URL(request.url).searchParams.get('s')

  if (!isSessionId(sessionId)) {
    throw redirect('/')
  }

  throw redirect('/', {
    headers: { 'Set-Cookie': await serializeSession(sessionId) },
  })
}
