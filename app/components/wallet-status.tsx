import { timeAgo, walletName } from '../lib/format'
import type { Card } from '../lib/loyalty.server'

// Where the pass lives and whether the phone has fetched the latest update.
// Built from Passmint webhooks, so it only shows when they're configured.
export function WalletStatus({ card, size = 'md' }: { card: Card; size?: 'md' | 'sm' }) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm'

  if (!card.addedAt) {
    return (
      <p className={`flex items-center gap-2 ${text} text-ink-400`}>
        <Dot tone="idle" />
        Not in a wallet yet
      </p>
    )
  }

  const waiting = card.pushedAt !== null && (card.deliveredAt ?? '') < card.pushedAt
  const where = walletName(card.walletPlatform)

  if (waiting) {
    return (
      <p className={`flex items-center gap-2 ${text} text-ink-600`}>
        <Dot tone="pending" />
        Update sent, waiting for the phone…
      </p>
    )
  }

  return (
    <p className={`flex items-center gap-2 ${text} text-ink-600`}>
      <Dot tone="live" />
      {card.deliveredAt ? (
        <span>
          Up to date in {where} ·{' '}
          <span suppressHydrationWarning>delivered {timeAgo(card.deliveredAt)}</span>
        </span>
      ) : (
        <span>In {where}</span>
      )}
    </p>
  )
}

function Dot({ tone }: { tone: 'idle' | 'pending' | 'live' }) {
  const color =
    tone === 'live'
      ? 'bg-leaf-600'
      : tone === 'pending'
        ? 'bg-butter-600 motion-safe:animate-pulse'
        : 'border border-ink-400'

  return <span aria-hidden className={`size-2 shrink-0 rounded-full ${color}`} />
}
