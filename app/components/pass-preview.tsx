import { BRAND } from '../lib/brand'
import type { CardState } from '../lib/rules'
import { REWARD_AT, STAMP_GOAL } from '../lib/rules'
import { PassStrip } from './pass-strip'

// A faithful replica of the pass as Apple Wallet draws it — logo row with the
// punch count, the strip art, the reward line, the barcode — so a visitor
// without the pass on a phone still sees exactly what changes. Field labels
// and values match what loyaltyFieldValues() sends.
export function PassPreview({
  count,
  state,
  serial,
  newest = false,
  placeholder = false,
  issuing = false,
}: {
  count: number
  state: CardState
  serial: string
  newest?: boolean
  /** Before a card exists: show the shape, dimmed. */
  placeholder?: boolean
  /** The card exists but Passmint is still issuing its pass. */
  issuing?: boolean
}) {
  const nextReward =
    state === 'reward'
      ? 'Free coffee: show this at the counter'
      : `${REWARD_AT - count} more for a free coffee`

  return (
    <div
      className={`overflow-hidden rounded-[14px] text-white shadow-[0_18px_40px_-18px_rgb(14_26_77/0.6)] transition-opacity ${placeholder ? 'opacity-45 saturate-50' : ''}`}
      style={{ backgroundColor: BRAND.cobalt }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="type-wide text-[15px] leading-none">punchline</span>
        </div>
        <div className="text-right leading-tight">
          <div className="text-[10px] font-semibold text-butter-400">Punches</div>
          {issuing ? (
            <span aria-hidden="true" className="skeleton-light mt-1 ml-auto h-5 w-14 rounded" />
          ) : (
            <div className="text-lg font-medium tabular-nums">
              {count} / {STAMP_GOAL}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <PassStrip count={count} state={state} newest={newest} className="block h-auto w-full" />
        {issuing && <span aria-hidden="true" className="skeleton-light absolute inset-0" />}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="text-[10px] font-semibold text-butter-400">Next reward</div>
        {issuing ? (
          <span aria-hidden="true" className="skeleton-light mt-1.5 h-4 w-48 rounded" />
        ) : (
          <div className="text-[15px] leading-snug">{nextReward}</div>
        )}
      </div>

      <div className="flex justify-center px-4 pb-5">
        <div className="rounded-md bg-white px-3 pt-2.5 pb-1.5">
          {issuing ? (
            <>
              <span aria-hidden="true" className="skeleton h-9 w-44 rounded" />
              <span aria-hidden="true" className="skeleton mx-auto mt-1.5 h-2 w-20 rounded" />
            </>
          ) : (
            <>
              <Barcode seed={serial} />
              <div className="mt-1 text-center text-[9px] tracking-wider text-ink-600 tabular-nums">
                {serial}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// The punched-hole mark, standing in for the template's logo image.
export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill={BRAND.butter} />
      <circle cx="10" cy="10" r="4.2" fill={BRAND.cobalt} />
    </svg>
  )
}

// A stand-in for the pass's PDF417 barcode: deterministic bars from the
// serial, so each card's looks its own without pretending to be scannable.
function Barcode({ seed }: { seed: string }) {
  const rows = 4
  const cols = 34
  let h = 2166136261

  for (const ch of seed) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  }

  const bits: boolean[] = []

  for (let i = 0; i < rows * cols; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    bits.push(((h >>> 7) & 1) === 1)
  }

  return (
    <svg viewBox={`0 0 ${cols + 8} ${rows * 3}`} className="h-9 w-44" aria-hidden="true">
      {/* PDF417's fixed start and stop columns. */}
      <rect x="0" y="0" width="3" height={rows * 3} fill={BRAND.ink} />
      <rect x={cols + 5} y="0" width="3" height={rows * 3} fill={BRAND.ink} />
      {bits.map((on, i) =>
        on ? (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
            key={i}
            x={4 + (i % cols)}
            y={Math.floor(i / cols) * 3}
            width="1"
            height="3"
            fill={BRAND.ink}
          />
        ) : null,
      )}
    </svg>
  )
}

// An iPhone-ish frame: enough to say "this is on your phone" without
// skeuomorphic chrome.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[330px] rounded-[46px] bg-ink-900 p-[11px] shadow-[0_40px_80px_-30px_rgb(14_26_77/0.55)]">
      <div className="relative flex min-h-[560px] flex-col rounded-[36px] bg-[#f2f2f7] px-3.5 pt-14 pb-6">
        <div
          aria-hidden
          className="absolute top-3 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-ink-900"
        />
        {children}
      </div>
    </div>
  )
}
