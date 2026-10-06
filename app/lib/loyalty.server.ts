import { logEvent } from './events.server'
import { issuePass, type PassmintEvent, pushLoyaltyState, voidPass } from './passmint.server'
import { type CardState, REWARD_AT } from './rules'

// A stamp card is one D1 row plus one wallet pass, joined by the Passmint
// pass id. Each transition pushes the new state to the wallet, then persists
// and logs it.
export interface Card {
  id: string
  shortId: string
  sessionId: string | null
  url: string
  downloadUrl: string | null
  googleWalletUrl: string | null
  stampCount: number
  state: CardState
  /** Which wallet the pass was added to; null until a webhook reports it. */
  walletPlatform: 'apple' | 'google' | null
  addedAt: string | null
  /** When the app last pushed new field values. */
  pushedAt: string | null
  /** When a phone last confirmed it fetched the update (webhook). */
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
}

interface CardRow {
  id: string
  short_id: string
  session_id: string | null
  url: string
  download_url: string | null
  google_wallet_url: string | null
  stamp_count: number
  state: CardState
  wallet_platform: 'apple' | 'google' | null
  added_at: string | null
  pushed_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export type ActivityKind =
  | 'issued'
  | 'punched'
  | 'reward'
  | 'redeemed'
  | 'added'
  | 'delivered'
  | 'removed'

/** Who pressed the button: the barista's counter page, or the visitor. */
export type Actor = 'counter' | 'visitor'

export interface Activity {
  id: number
  kind: ActivityKind
  stampCount: number | null
  /** An Actor for app events; the wallet platform for webhook events. */
  actor: string | null
  at: string
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    shortId: row.short_id,
    sessionId: row.session_id,
    url: row.url,
    downloadUrl: row.download_url,
    googleWalletUrl: row.google_wallet_url,
    stampCount: row.stamp_count,
    state: row.state,
    walletPlatform: row.wallet_platform,
    addedAt: row.added_at,
    pushedAt: row.pushed_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Issues a new card for a session. Passmint first: if issuance fails, no
// orphan row lands in D1. Returns the session's previous cards so the caller
// can retire them (see retireCards) without holding up the redirect.
export async function issueCard(
  env: Env,
  sessionId: string,
): Promise<{ card: Card; replaced: string[] }> {
  const pass = await issuePass(env)
  const now = new Date().toISOString()

  const { results: previous } = await env.DB.prepare('SELECT id FROM cards WHERE session_id = ?1')
    .bind(sessionId)
    .all<{ id: string }>()

  const row = await env.DB.prepare(
    `INSERT INTO cards (id, short_id, serial_number, session_id, url, download_url, google_wallet_url, stamp_count, state, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'active', ?8, ?8)
     RETURNING *`,
  )
    .bind(
      pass.id,
      pass.short_id,
      pass.serial_number,
      sessionId,
      pass.url,
      pass.download_url,
      pass.google_wallet_url,
      now,
    )
    .first<CardRow>()

  logEvent('punchline', 'pass.issued', {
    passId: pass.id,
    shortId: pass.short_id,
    mode: pass.mode,
    warnings: pass.warnings,
  })

  if (!row) {
    throw new Error(`Inserted card ${pass.id} but D1 returned no row`)
  }

  await recordActivity(env, pass.id, 'issued', { stampCount: 0, actor: 'visitor', at: now })

  return { card: toCard(row), replaced: previous.map((p) => p.id) }
}

// Voids each pass in Passmint, then drops its row. A failed void keeps the
// row, so the daily expiry sweep retries it.
export async function retireCards(env: Env, ids: string[], reason: string): Promise<void> {
  for (const id of ids) {
    try {
      await voidPass(env, id)
      await env.DB.batch([
        env.DB.prepare('DELETE FROM card_activity WHERE card_id = ?1').bind(id),
        env.DB.prepare('DELETE FROM cards WHERE id = ?1').bind(id),
      ])
      logEvent('punchline', 'pass.retired', { passId: id, reason })
    } catch (err) {
      logEvent('punchline', 'pass.retire_failed', { passId: id, reason, error: String(err) })
    }
  }
}

// Cards nobody has touched in `days` days. Each one is a live pass counting
// against the Passmint plan, so a public demo needs to let them go.
export async function expireIdleCards(env: Env, days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { results } = await env.DB.prepare(
    'SELECT id FROM cards WHERE updated_at < ?1 ORDER BY updated_at LIMIT 200',
  )
    .bind(cutoff)
    .all<{ id: string }>()

  await retireCards(
    env,
    results.map((r) => r.id),
    'expired',
  )
}

async function recordActivity(
  env: Env,
  cardId: string,
  kind: ActivityKind,
  {
    stampCount = null,
    actor = null,
    at,
  }: { stampCount?: number | null; actor?: string | null; at: string },
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO card_activity (card_id, kind, stamp_count, actor, at) VALUES (?1, ?2, ?3, ?4, ?5)',
  )
    .bind(cardId, kind, stampCount, actor, at)
    .run()
}

export async function listActivity(env: Env, cardId: string, limit = 8): Promise<Activity[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, kind, stamp_count, actor, at FROM card_activity WHERE card_id = ?1 ORDER BY id DESC LIMIT ?2',
  )
    .bind(cardId, limit)
    .all<{
      id: number
      kind: ActivityKind
      stamp_count: number | null
      actor: string | null
      at: string
    }>()

  return results.map((r) => ({
    id: r.id,
    kind: r.kind,
    stampCount: r.stamp_count,
    actor: r.actor,
    at: r.at,
  }))
}

export async function getCard(env: Env, id: string): Promise<Card | null> {
  const row = await env.DB.prepare('SELECT * FROM cards WHERE id = ?1').bind(id).first<CardRow>()

  return row ? toCard(row) : null
}

// A session's current card: the newest one it issued.
export async function getSessionCard(env: Env, sessionId: string): Promise<Card | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM cards WHERE session_id = ?1 ORDER BY created_at DESC LIMIT 1',
  )
    .bind(sessionId)
    .first<CardRow>()

  return row ? toCard(row) : null
}

// The counter's view: this browser's cards, newest first. A public demo
// shouldn't list everyone's passes, so there is no "all cards" query.
export async function listSessionCards(env: Env, sessionId: string): Promise<Card[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM cards WHERE session_id = ?1 ORDER BY created_at DESC LIMIT 5',
  )
    .bind(sessionId)
    .all<CardRow>()

  return results.map(toCard)
}

// What a till does when it scans a pass: find the card by the code printed
// under its barcode.
export async function getCardByShortId(env: Env, shortId: string): Promise<Card | null> {
  const row = await env.DB.prepare('SELECT * FROM cards WHERE short_id = ?1')
    .bind(shortId)
    .first<CardRow>()

  return row ? toCard(row) : null
}

// Pushes a transition that D1 already committed. If Passmint refuses it, the
// row is put back (guarded on the timestamp we just wrote, so a concurrent
// transition isn't clobbered) and the error propagates, keeping D1 and the
// pass on the phone in agreement.
async function pushOrRollback(env: Env, card: Card, previous: Pick<Card, 'stampCount' | 'state'>) {
  try {
    await pushLoyaltyState(env, card.id, card.stampCount, card.state)
  } catch (err) {
    await env.DB.prepare(
      // pushed_at is cleared rather than restored: nothing new went out, so
      // the receipt shouldn't claim an update is on its way.
      'UPDATE cards SET stamp_count = ?2, state = ?3, pushed_at = NULL WHERE id = ?1 AND updated_at = ?4',
    )
      .bind(card.id, previous.stampCount, previous.state, card.updatedAt)
      .run()

    throw err
  }
}

// A single guarded UPDATE, not read-modify-write: two actors stamping the
// same card (the counter and the visitor's own button) is the demo's whole
// premise, so the write is the serialization point. Stamps stop at
// REWARD_AT — the tenth slot is the free coffee, claimed via redeemCard.
export async function stampCard(env: Env, id: string, actor: Actor): Promise<Card | null> {
  const now = new Date().toISOString()
  const row = await env.DB.prepare(
    `UPDATE cards
     SET stamp_count = stamp_count + 1,
         state = CASE WHEN stamp_count + 1 >= ?2 THEN 'reward' ELSE 'active' END,
         updated_at = ?3,
         pushed_at = ?3
     WHERE id = ?1 AND state = 'active' AND stamp_count < ?2
     RETURNING *`,
  )
    .bind(id, REWARD_AT, now)
    .first<CardRow>()

  if (!row) {
    return getCard(env, id)
  }

  const card = toCard(row)

  await pushOrRollback(env, card, { stampCount: card.stampCount - 1, state: 'active' })

  logEvent('punchline', card.state === 'reward' ? 'pass.reward_earned' : 'pass.stamped', {
    passId: card.id,
    shortId: card.shortId,
    stampCount: card.stampCount,
  })

  await recordActivity(env, card.id, card.state === 'reward' ? 'reward' : 'punched', {
    stampCount: card.stampCount,
    actor,
    at: now,
  })

  return card
}

// Demo shortcut: jump an active card straight to the reward state (9 punches),
// so a visitor can see the free-coffee art without nine taps. Same guarded
// write, push and rollback as a punch.
export async function skipToReward(env: Env, id: string, actor: Actor): Promise<Card | null> {
  const now = new Date().toISOString()
  const before = await getCard(env, id)
  const row = await env.DB.prepare(
    `UPDATE cards
     SET stamp_count = ?2, state = 'reward', updated_at = ?3, pushed_at = ?3
     WHERE id = ?1 AND state = 'active'
     RETURNING *`,
  )
    .bind(id, REWARD_AT, now)
    .first<CardRow>()

  if (!row || !before) {
    return getCard(env, id)
  }

  const card = toCard(row)

  await pushOrRollback(env, card, { stampCount: before.stampCount, state: 'active' })

  logEvent('punchline', 'pass.reward_earned', {
    passId: card.id,
    shortId: card.shortId,
    stampCount: card.stampCount,
    skipped: true,
  })

  await recordActivity(env, card.id, 'reward', { stampCount: card.stampCount, actor, at: now })

  return card
}

// Reset to zero instead of voiding, so the same card replays forever.
export async function redeemCard(env: Env, id: string, actor: Actor): Promise<Card | null> {
  const now = new Date().toISOString()
  const row = await env.DB.prepare(
    `UPDATE cards
     SET stamp_count = 0, state = 'active', updated_at = ?2, pushed_at = ?2
     WHERE id = ?1 AND state = 'reward'
     RETURNING *`,
  )
    .bind(id, now)
    .first<CardRow>()

  if (!row) {
    return getCard(env, id)
  }

  const card = toCard(row)

  await pushOrRollback(env, card, { stampCount: REWARD_AT, state: 'reward' })

  logEvent('punchline', 'pass.redeemed', {
    passId: card.id,
    shortId: card.shortId,
    stampCount: card.stampCount,
  })

  await recordActivity(env, card.id, 'redeemed', { stampCount: 0, actor, at: now })

  return card
}

// Folds a verified webhook into the card's wallet status. Events for passes
// we don't hold (retired cards, other apps on the same account) match no row
// and are ignored. Webhooks can arrive out of order, so timestamps only move
// forward.
const WALLET_ACTIVITY: Partial<Record<PassmintEvent['type'], ActivityKind>> = {
  'pass.added_to_wallet': 'added',
  'pass.update_delivered': 'delivered',
  'pass.removed': 'removed',
}

export async function recordWalletEvent(env: Env, event: PassmintEvent): Promise<void> {
  const passId = event.data.object.pass.id
  const at = event.created_at
  const kind = WALLET_ACTIVITY[event.type]

  if (kind && (await getCard(env, passId))) {
    await recordActivity(env, passId, kind, { actor: event.source.platform, at })
  }

  switch (event.type) {
    case 'pass.added_to_wallet':
      await env.DB.prepare(
        `UPDATE cards SET added_at = ?2, wallet_platform = COALESCE(?3, wallet_platform)
         WHERE id = ?1 AND (added_at IS NULL OR added_at < ?2)`,
      )
        .bind(passId, at, event.source.platform)
        .run()
      return
    case 'pass.removed':
      await env.DB.prepare(
        'UPDATE cards SET added_at = NULL WHERE id = ?1 AND (added_at IS NULL OR added_at < ?2)',
      )
        .bind(passId, at)
        .run()
      return
    case 'pass.update_delivered':
      await env.DB.prepare(
        `UPDATE cards SET delivered_at = ?2, wallet_platform = COALESCE(wallet_platform, ?3)
         WHERE id = ?1 AND (delivered_at IS NULL OR delivered_at < ?2)`,
      )
        .bind(passId, at, event.source.platform)
        .run()
      return
  }
}
