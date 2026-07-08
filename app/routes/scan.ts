import { redirect } from 'react-router'
import { cloudflareContext } from '../context'
import { cardCookie } from '../lib/card-cookie.server'
import { issueCard } from '../lib/loyalty.server'
import type { Route } from './+types/scan'

// The URL behind the landing-page QR. Each scan issues a fresh pass with its
// own serial — no signup — then remembers it on this browser and sends it
// home, where the page renders as "your card".
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)
  const card = await issueCard(env)

  throw redirect('/', {
    headers: { 'Set-Cookie': await cardCookie.serialize(card.id) },
  })
}
