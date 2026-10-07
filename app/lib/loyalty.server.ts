import { logEvent } from './events.server'
import {
  describePassmintError,
  isIssueInProgress,
  issuePass,
  type PassmintEvent,
  pushLoyaltyState,
  voidPass,
} from './passmint.server'
import { type CardState, REWARD_AT } from './rules'

// A card is one D1 row plus one wallet pass. The row comes first: /scan
// creates it and redirects at once, and the pass is issued in the background.
type IssueState = 'issuing' | 'ready' | 'failed'

export interface Card {
  id: string
  passId: string | null
  issueState: IssueState
  issueError: string | null
  shortId: string | null
  sessionId: string | null
  url: string | null
  downloadUrl: string | null
  googleWalletUrl: string | null
  stampCount: number
  state: CardState
  /** Wallet status, reported by Passmint webhooks. */
  walletPlatform: 'apple' | 'google' | null
  addedAt: string | null
  pushedAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
}

interface CardRow {
  id: string
  pass_id: string | null
  issue_state: IssueState
  issue_error: string | null
  short_id: string | null
  session_id: string | null
  url: string | null
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

type ActivityKind = 'issued' | 'punched' | 'reward' | 'redeemed' | 'added' | 'delivered' | 'removed'

/** Who pressed the button: the counter page or the visitor. */
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
    // Cards from before background issuing used the pass id as their id.
    passId: row.pass_id ?? (row.id.startsWith('pass_') ? row.id : null),
    issueState: row.issue_state,
    issueError: row.issue_error,
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

const now = () => new Date().toISOString()

async function firstCard(env: Env, sql: string, ...params: unknown[]): Promise<Card | null> {
  const row = await env.DB.prepare(sql)
    .bind(...params)
    .first<CardRow>()

  return row ? toCard(row) : null
}

const getCard = (env: Env, id: string) => firstCard(env, 'SELECT * FROM cards WHERE id = ?1', id)

/** A session's current card: the newest it issued. */
export const getSessionCard = (env: Env, sessionId: string) =>
  firstCard(env, 'SELECT * FROM cards WHERE session_id = ?1 ORDER BY created_at DESC', sessionId)

/** Looks a card up the way a till would: by the code under its barcode, or its short id. */
export const getCardByCode = (env: Env, code: string) =>
  firstCard(env, 'SELECT * FROM cards WHERE serial_number = ?1 OR short_id = ?1', code)

// The counter shows this browser's cards only; a public demo shouldn't list
// everyone's passes.
export async function listSessionCards(env: Env, sessionId: string): Promise<Card[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM cards WHERE session_id = ?1 ORDER BY created_at DESC LIMIT 5',
  )
    .bind(sessionId)
    .all<CardRow>()

  return results.map(toCard)
}

export async function startCard(env: Env, sessionId: string): Promise<Card> {
  const card = await firstCard(
    env,
    `INSERT INTO cards (id, session_id, issue_state, created_at, updated_at)
     VALUES (?1, ?2, 'issuing', ?3, ?3) RETURNING *`,
    `card_${crypto.randomUUID()}`,
    sessionId,
    now(),
  )

  if (!card) {
    throw new Error('D1 returned no row for the new card')
  }

  return card
}

// Issues the card's pass. Runs in the background after /scan and again if the
// page nudges a card that's still issuing (the background run can be cut
// off), so every run for one attempt shares an idempotency key and Passmint
// returns the same pass. "Try again" starts a new attempt with a new key.
// Never throws: failures are stored on the card for the page to show.
export async function completeIssue(env: Env, cardId: string): Promise<void> {
  const card = await getCard(env, cardId)

  if (card?.issueState !== 'issuing') {
    return
  }

  try {
    const pass = await issuePass(env, `punchline-issue:${card.id}:${card.createdAt}`)
    const at = now()
    const issued = await firstCard(
      env,
      `UPDATE cards
       SET pass_id = ?2, short_id = ?3, serial_number = ?4, url = ?5, download_url = ?6,
           google_wallet_url = ?7, issue_state = 'ready', issue_error = NULL, updated_at = ?8
       WHERE id = ?1 AND issue_state != 'ready' RETURNING *`,
      cardId,
      pass.id,
      pass.short_id,
      pass.serial_number,
      pass.url,
      pass.download_url,
      pass.google_wallet_url,
      at,
    )

    logEvent('punchline', 'pass.issued', { cardId, passId: pass.id, warnings: pass.warnings })

    if (!issued) {
      // Another run already filled the card in (same pass), or the card was
      // retired meanwhile, which would leave this pass orphaned.
      if ((await getCard(env, cardId))?.passId !== pass.id) {
        await voidPass(env, pass.id)
      }

      return
    }

    await recordActivity(env, cardId, 'issued', { stampCount: 0, actor: 'visitor', at })

    // A session holds one card: retire the ones this replaces.
    const { results: older } = await env.DB.prepare(
      'SELECT id FROM cards WHERE session_id = ?1 AND id != ?2',
    )
      .bind(issued.sessionId, cardId)
      .all<{ id: string }>()

    await retireCards(
      env,
      older.map((c) => c.id),
      'replaced',
    )
  } catch (err) {
    if (isIssueInProgress(err)) {
      return
    }

    logEvent('punchline', 'pass.issue_failed', { cardId, error: String(err) })
    await env.DB.prepare(
      "UPDATE cards SET issue_state = 'failed', issue_error = ?2 WHERE id = ?1 AND issue_state = 'issuing'",
    )
      .bind(cardId, describePassmintError(err) ?? 'Passmint could not be reached. Try again.')
      .run()
  }
}

/** Starts a new issue attempt for a card that failed or stalled. */
export async function restartIssue(env: Env, cardId: string): Promise<boolean> {
  const { meta } = await env.DB.prepare(
    "UPDATE cards SET issue_state = 'issuing', issue_error = NULL, created_at = ?2 WHERE id = ?1 AND issue_state != 'ready'",
  )
    .bind(cardId, now())
    .run()

  return meta.changes > 0
}

// Voids each card's pass, then deletes the card. Voided passes stop counting
// against the Passmint plan. A failed void keeps the card for the next sweep.
async function retireCards(env: Env, ids: string[], reason: string): Promise<void> {
  for (const id of ids) {
    try {
      const passId = (await getCard(env, id))?.passId

      if (passId) {
        await voidPass(env, passId)
      }

      await env.DB.batch([
        env.DB.prepare('DELETE FROM card_activity WHERE card_id = ?1').bind(id),
        env.DB.prepare('DELETE FROM cards WHERE id = ?1').bind(id),
      ])
      logEvent('punchline', 'pass.retired', { cardId: id, passId, reason })
    } catch (err) {
      logEvent('punchline', 'pass.retire_failed', { cardId: id, reason, error: String(err) })
    }
  }
}

/** Retires cards untouched for `days` days (run daily by the cron trigger). */
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
    'SELECT id, kind, stamp_count AS stampCount, actor, at FROM card_activity WHERE card_id = ?1 ORDER BY id DESC LIMIT ?2',
  )
    .bind(cardId, limit)
    .all<Activity>()

  return results
}

// The three things that can happen to an issued card. Each is a single
// guarded UPDATE, so two actors pressing at once (the counter and the
// visitor) can't over-punch. `undo` restores the card if the push fails.
const TRANSITIONS = {
  stamp: {
    set: `stamp_count = stamp_count + 1, state = CASE WHEN stamp_count + 1 >= ${REWARD_AT} THEN 'reward' ELSE 'active' END`,
    where: `state = 'active' AND stamp_count < ${REWARD_AT}`,
    undo: (card: Card) => ({ stampCount: card.stampCount - 1, state: 'active' as const }),
  },
  // Demo shortcut straight to the free-coffee card.
  skip: {
    set: `stamp_count = ${REWARD_AT}, state = 'reward'`,
    where: "state = 'active'",
    undo: (_: Card, before: Card) => ({ stampCount: before.stampCount, state: 'active' as const }),
  },
  // Resets rather than voids, so a card replays forever.
  redeem: {
    set: "stamp_count = 0, state = 'active'",
    where: "state = 'reward'",
    undo: () => ({ stampCount: REWARD_AT, state: 'reward' as const }),
  },
}

export async function transitionCard(
  env: Env,
  id: string,
  transition: keyof typeof TRANSITIONS,
  actor: Actor,
): Promise<Card | null> {
  const { set, where, undo } = TRANSITIONS[transition]
  const before = await getCard(env, id)
  const at = now()
  const card = await firstCard(
    env,
    `UPDATE cards SET ${set}, updated_at = ?2, pushed_at = ?2
     WHERE id = ?1 AND issue_state = 'ready' AND ${where} RETURNING *`,
    id,
    at,
  )

  if (!card || !before) {
    return before
  }

  await pushOrRollback(env, card, undo(card, before))

  const kind = transition === 'redeem' ? 'redeemed' : card.state === 'reward' ? 'reward' : 'punched'

  logEvent('punchline', `pass.${kind}`, { passId: card.passId, stampCount: card.stampCount })
  await recordActivity(env, card.id, kind, { stampCount: card.stampCount, actor, at })

  return card
}

// Pushes a transition D1 has already committed. If Passmint refuses it, the
// row goes back (guarded on our timestamp, so a newer transition isn't
// clobbered) and the error propagates: D1 never claims a punch the phone
// didn't get.
async function pushOrRollback(env: Env, card: Card, previous: Pick<Card, 'stampCount' | 'state'>) {
  try {
    if (!card.passId) {
      throw new Error(`Card ${card.id} has no pass yet`)
    }

    await pushLoyaltyState(env, card.passId, card.stampCount, card.state)
  } catch (err) {
    await env.DB.prepare(
      'UPDATE cards SET stamp_count = ?2, state = ?3, pushed_at = NULL WHERE id = ?1 AND updated_at = ?4',
    )
      .bind(card.id, previous.stampCount, previous.state, card.updatedAt)
      .run()

    throw err
  }
}

// Folds a verified Passmint webhook into the card's wallet status. Webhooks
// can arrive out of order, so each timestamp only moves forward.
const WALLET_UPDATES: Partial<Record<PassmintEvent['type'], { kind: ActivityKind; sql: string }>> =
  {
    'pass.added_to_wallet': {
      kind: 'added',
      sql: `UPDATE cards SET added_at = ?2, wallet_platform = COALESCE(?3, wallet_platform)
          WHERE id = ?1 AND (added_at IS NULL OR added_at < ?2)`,
    },
    'pass.removed': {
      kind: 'removed',
      sql: `UPDATE cards SET added_at = NULL, wallet_platform = COALESCE(?3, wallet_platform)
          WHERE id = ?1 AND (added_at IS NULL OR added_at < ?2)`,
    },
    'pass.update_delivered': {
      kind: 'delivered',
      sql: `UPDATE cards SET delivered_at = ?2, wallet_platform = COALESCE(wallet_platform, ?3)
          WHERE id = ?1 AND (delivered_at IS NULL OR delivered_at < ?2)`,
    },
  }

export async function recordWalletEvent(env: Env, event: PassmintEvent): Promise<void> {
  const update = WALLET_UPDATES[event.type]
  const passId = event.data.object.pass.id
  // Events for passes we don't hold (retired cards, other apps) are ignored.
  const card =
    update && (await firstCard(env, 'SELECT * FROM cards WHERE pass_id = ?1 OR id = ?1', passId))

  if (!update || !card) {
    return
  }

  await recordActivity(env, card.id, update.kind, {
    actor: event.source.platform,
    at: event.created_at,
  })
  await env.DB.prepare(update.sql).bind(card.id, event.created_at, event.source.platform).run()
}
