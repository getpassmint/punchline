import type { Activity, Card } from './loyalty.server'
import { REWARD_AT } from './rules'

// The card as it will look once a pending transition lands, so the page can
// show it immediately. If Passmint refuses, the loader data never changed and
// the page snaps back. Mirrors the guards in loyalty.server.ts.
export function applyIntent(card: Card, intent: FormDataEntryValue | null | undefined): Card {
  if (intent === 'stamp' && card.state === 'active' && card.stampCount < REWARD_AT) {
    const stampCount = card.stampCount + 1

    return { ...card, stampCount, state: stampCount >= REWARD_AT ? 'reward' : 'active' }
  }

  if (intent === 'skip' && card.state === 'active') {
    return { ...card, stampCount: REWARD_AT, state: 'reward' }
  }

  if (intent === 'redeem' && card.state === 'reward') {
    return { ...card, stampCount: 0, state: 'active' }
  }

  return card
}

export type FeedItem = Activity & { pending?: boolean }

// A placeholder feed row for the pending transition.
export function pendingActivity(before: Card, after: Card, actor: string): FeedItem | null {
  if (after === before) {
    return null
  }

  const kind =
    after.state === 'reward' ? 'reward' : before.state === 'reward' ? 'redeemed' : 'punched'

  return {
    id: -1,
    kind,
    stampCount: after.stampCount,
    actor,
    at: new Date().toISOString(),
    pending: true,
  }
}
