import { timeAgo, walletName } from '../lib/format'
import type { Activity } from '../lib/loyalty.server'
import type { FeedItem } from '../lib/optimistic'
import { STAMP_GOAL } from '../lib/rules'

// The card's history, newest first, each row naming the Passmint call or
// webhook behind it.
export function ActivityFeed({ items, freshIds }: { items: FeedItem[]; freshIds: Set<number> }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-400/40 px-5 py-6 text-sm text-ink-600">
        Scan the code and you'll see each step here as it happens, including your phone confirming
        it got each update.
      </p>
    )
  }

  // Delivery receipts say how long after its push the phone picked it up.
  const ordered = [...items].reverse()
  const latency = new Map<number, number>()
  let lastPush: string | null = null

  for (const item of ordered) {
    if (item.kind === 'punched' || item.kind === 'reward' || item.kind === 'redeemed') {
      lastPush = item.at
    } else if (item.kind === 'delivered' && lastPush) {
      latency.set(item.id, Date.parse(item.at) - Date.parse(lastPush))
      lastPush = null
    }
  }

  return (
    <ol className="flex flex-col">
      {items.map((item) => {
        const described = describe(item, latency.get(item.id))
        const title = item.pending && item.kind === 'issued' ? 'Issuing your pass' : described.title
        const { call } = described

        return (
          <li
            key={item.id}
            className={`grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 border-b border-ink-900/8 py-2 last:border-0 ${freshIds.has(item.id) ? 'feed-in' : ''}`}
          >
            <span
              aria-hidden
              className={`size-2 translate-y-[-1px] rounded-full ${isWebhook(item) ? 'bg-leaf-600' : 'bg-cobalt-500'} ${item.pending ? 'motion-safe:animate-pulse' : ''}`}
            />
            <div className="min-w-0">
              <div className="text-[15px] text-ink-900">{title}</div>
              <code className="text-xs text-ink-400">{call}</code>
            </div>
            <span className="text-xs text-ink-400 tabular-nums" suppressHydrationWarning>
              {item.pending ? 'sending…' : timeAgo(item.at)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function isWebhook(item: Activity): boolean {
  return item.kind === 'added' || item.kind === 'delivered' || item.kind === 'removed'
}

function describe(item: Activity, latencyMs?: number): { title: string; call: string } {
  const by = item.actor === 'counter' ? ' at the counter' : ''

  switch (item.kind) {
    case 'issued':
      return { title: 'Card issued', call: 'passes.create()' }
    case 'punched':
      return {
        title: `Punch ${item.stampCount} of ${STAMP_GOAL - 1}${by}`,
        call: 'passes.update()',
      }
    case 'reward':
      return { title: `Free coffee unlocked${by}`, call: 'passes.update()' }
    case 'redeemed':
      return { title: `Free coffee redeemed${by}, card reset`, call: 'passes.update()' }
    case 'added':
      return {
        title: `Added to ${walletName(item.actor as 'apple' | 'google' | null)}`,
        call: 'webhook: pass.added_to_wallet',
      }
    case 'delivered':
      return {
        title:
          latencyMs !== undefined && latencyMs >= 0
            ? `Phone updated ${(latencyMs / 1000).toFixed(1)}s after the push`
            : 'Phone picked up the update',
        call: 'webhook: pass.update_delivered',
      }
    case 'removed':
      return { title: 'Removed from the wallet', call: 'webhook: pass.removed' }
  }
}
