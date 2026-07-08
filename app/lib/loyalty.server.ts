import { logEvent } from './events.server'
import { type CardState, issuePass, pushLoyaltyState, REWARD_AT } from './passmint.server'

// A stamp card is one D1 row plus one wallet pass, joined by the Passmint
// pass id. Each transition pushes the new state to the wallet, then persists
// and logs it.
export interface Card {
  id: string
  shortId: string
  serialNumber: string
  url: string
  downloadUrl: string | null
  googleWalletUrl: string | null
  stampCount: number
  state: CardState
  createdAt: string
  updatedAt: string
}

interface CardRow {
  id: string
  short_id: string
  serial_number: string
  url: string
  download_url: string | null
  google_wallet_url: string | null
  stamp_count: number
  state: CardState
  created_at: string
  updated_at: string
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    shortId: row.short_id,
    serialNumber: row.serial_number,
    url: row.url,
    downloadUrl: row.download_url,
    googleWalletUrl: row.google_wallet_url,
    stampCount: row.stamp_count,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function issueCard(env: Env): Promise<Card> {
  // Passmint first: if issuance fails, no orphan row lands in D1.
  const pass = await issuePass(env)
  const now = new Date().toISOString()

  await env.DB.prepare(
    "INSERT INTO cards (id, short_id, serial_number, url, download_url, google_wallet_url, stamp_count, state, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 'active', ?7, ?7)",
  )
    .bind(
      pass.id,
      pass.short_id,
      pass.serial_number,
      pass.url,
      pass.download_url,
      pass.google_wallet_url,
      now,
    )
    .run()

  logEvent('tenthcup', 'pass.issued', {
    passId: pass.id,
    shortId: pass.short_id,
    mode: pass.mode,
    warnings: pass.warnings,
  })

  return {
    id: pass.id,
    shortId: pass.short_id,
    serialNumber: pass.serial_number,
    url: pass.url,
    downloadUrl: pass.download_url,
    googleWalletUrl: pass.google_wallet_url,
    stampCount: 0,
    state: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

export async function getCard(env: Env, id: string): Promise<Card | null> {
  const row = await env.DB.prepare('SELECT * FROM cards WHERE id = ?1').bind(id).first<CardRow>()

  return row ? toCard(row) : null
}

export async function listRecentCards(env: Env, limit = 12): Promise<Card[]> {
  const { results } = await env.DB.prepare('SELECT * FROM cards ORDER BY updated_at DESC LIMIT ?1')
    .bind(limit)
    .all<CardRow>()

  return results.map(toCard)
}

// A single guarded UPDATE, not read-modify-write: two actors stamping the
// same card (the counter and the phone's "simulate a visit") is the demo's
// whole premise, so the write is the serialization point. Stamps stop at
// REWARD_AT — the tenth slot is the free coffee, claimed via redeemCard.
export async function stampCard(env: Env, id: string): Promise<Card | null> {
  const now = new Date().toISOString()
  const row = await env.DB.prepare(
    `UPDATE cards
     SET stamp_count = stamp_count + 1,
         state = CASE WHEN stamp_count + 1 >= ?2 THEN 'reward' ELSE 'active' END,
         updated_at = ?3
     WHERE id = ?1 AND state = 'active' AND stamp_count < ?2
     RETURNING *`,
  )
    .bind(id, REWARD_AT, now)
    .first<CardRow>()

  if (!row) {
    return getCard(env, id)
  }

  const card = toCard(row)

  await pushLoyaltyState(env, card.id, card.stampCount, card.state)

  logEvent('tenthcup', card.state === 'reward' ? 'pass.reward_earned' : 'pass.stamped', {
    passId: card.id,
    shortId: card.shortId,
    stampCount: card.stampCount,
  })

  return card
}

// Reset to zero instead of voiding, so the same card replays forever.
export async function redeemCard(env: Env, id: string): Promise<Card | null> {
  const now = new Date().toISOString()
  const row = await env.DB.prepare(
    `UPDATE cards
     SET stamp_count = 0, state = 'active', updated_at = ?2
     WHERE id = ?1 AND state = 'reward'
     RETURNING *`,
  )
    .bind(id, now)
    .first<CardRow>()

  if (!row) {
    return getCard(env, id)
  }

  const card = toCard(row)

  await pushLoyaltyState(env, card.id, card.stampCount, card.state)

  logEvent('tenthcup', 'pass.redeemed', {
    passId: card.id,
    shortId: card.shortId,
    stampCount: card.stampCount,
  })

  return card
}
