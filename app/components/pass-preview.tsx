import { BRAND } from '../lib/brand'
import type { CardState } from '../lib/rules'
import { REWARD_AT, STAMP_GOAL } from '../lib/rules'
import { PassStrip } from './pass-strip'

export type WalletPlatform = 'apple' | 'google'

/**
 * The code printed under the replica's barcode. The real pass encodes its
 * serial number there; the replica uses an obvious sample so nobody mistakes
 * it for (or tries to scan) the real thing.
 */
export const SAMPLE_CODE = '123abc'

interface PreviewProps {
  count: number
  state: CardState
  newest?: boolean
  /** Before a card exists: show the shape, dimmed. */
  placeholder?: boolean
  /** The card exists but Passmint is still issuing its pass. */
  issuing?: boolean
  /** Test-mode passes carry a "[TEST]" watermark; mirror it. */
  testMode?: boolean
}

// A replica of the pass as each wallet draws it, so a visitor without the
// pass on their phone still sees what changes. Labels and values match what
// loyaltyFieldValues() sends; the barcode is a sample (see SAMPLE_CODE).
export function PassPreview({ platform, ...props }: PreviewProps & { platform: WalletPlatform }) {
  return platform === 'google' ? <GooglePass {...props} /> : <ApplePass {...props} />
}

// Apple Wallet's storeCard: logo row with the punch count, the strip art,
// the reward line, then the barcode on a white panel.
function ApplePass({ count, state, newest, placeholder, issuing, testMode }: PreviewProps) {
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
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark />
          <span className="type-wide truncate text-[15px] leading-none">
            punchline{testMode && <span className="font-medium"> [TEST]</span>}
          </span>
        </div>
        <div className="shrink-0 text-right leading-tight">
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

      <Strip count={count} state={state} newest={newest} issuing={issuing} />

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
              <span aria-hidden="true" className="skeleton mx-auto mt-1.5 h-2 w-12 rounded" />
            </>
          ) : (
            <>
              <Pdf417 className="h-9 w-44" />
              <div className="mt-1 text-center text-[9px] tracking-wider text-ink-600">
                {SAMPLE_CODE}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Google Wallet's loyalty card: logo and issuer name, the program name as a
// large title, the barcode with its code underneath, and the strip art as
// the hero image along the bottom. Google doesn't show the punch count or
// reward line on the card face; the hero image carries the punches.
function GooglePass({ count, state, newest, placeholder, issuing, testMode }: PreviewProps) {
  const name = testMode ? 'punchline [TEST]' : 'punchline'

  return (
    <div
      className={`overflow-hidden rounded-[22px] text-white shadow-[0_18px_40px_-18px_rgb(14_26_77/0.6)] transition-opacity ${placeholder ? 'opacity-45 saturate-50' : ''}`}
      style={{ backgroundColor: BRAND.cobalt }}
    >
      <div className="flex items-center gap-3 px-5 pt-5">
        <LogoMark size={28} />
        <span className="truncate text-[15px]">{name}</span>
      </div>
      <div className="truncate px-5 pt-4 text-[26px] leading-tight">{name}</div>

      <div className="px-5 pt-5 pb-4">
        <div className="flex justify-center rounded-2xl bg-white px-3 py-3">
          {issuing ? (
            <span aria-hidden="true" className="skeleton h-14 w-full rounded" />
          ) : (
            <Pdf417 className="h-14 w-full" />
          )}
        </div>
        <div className="mt-2.5 text-center text-sm tracking-wide">
          {issuing ? (
            <span aria-hidden="true" className="skeleton-light mx-auto h-3 w-14 rounded" />
          ) : (
            SAMPLE_CODE
          )}
        </div>
      </div>

      <Strip count={count} state={state} newest={newest} issuing={issuing} />
    </div>
  )
}

function Strip({
  count,
  state,
  newest,
  issuing,
}: Pick<PreviewProps, 'count' | 'state' | 'newest' | 'issuing'>) {
  return (
    <div className="relative">
      <PassStrip count={count} state={state} newest={newest} className="block h-auto w-full" />
      {issuing && <span aria-hidden="true" className="skeleton-light absolute inset-0" />}
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

// A sample PDF417, the barcode both wallets show for this pass. It follows
// the symbology's shape (the fixed start pattern, row indicators, 17-module
// codewords of four bars and four spaces, the stop pattern) with codewords
// from a fixed seed, so it looks right and renders the same on the server
// and the client, but encodes nothing.
const START = [8, 1, 1, 1, 1, 1, 1, 3]
const STOP = [7, 1, 1, 3, 1, 1, 1, 2, 1]
const ROWS = 6
const DATA_COLUMNS = 3

function sampleRows(): number[][] {
  let seed = 0x2f6e2b1
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
    return seed >>> 16
  }
  // Eight widths of 1..6 modules that sum to 17: one codeword.
  const codeword = () => {
    const widths = Array(8).fill(1)
    let left = 17 - 8

    while (left > 0) {
      const i = next() % 8

      if (widths[i] < 6) {
        widths[i] += 1
        left -= 1
      }
    }

    return widths
  }

  return Array.from({ length: ROWS }, () => [
    ...START,
    ...Array.from({ length: DATA_COLUMNS + 2 }, codeword).flat(),
    ...STOP,
  ])
}

const SAMPLE_ROWS = sampleRows()
const SAMPLE_WIDTH = SAMPLE_ROWS[0]?.reduce((a, b) => a + b, 0) ?? 0

function Pdf417({ className }: { className?: string }) {
  const rowHeight = 3

  return (
    <svg
      viewBox={`0 0 ${SAMPLE_WIDTH} ${ROWS * rowHeight}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {SAMPLE_ROWS.map((widths, row) => {
        let x = 0

        return widths.map((w, i) => {
          const bar = i % 2 === 0
          const rect = bar ? (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed sample
              key={`${row}-${i}`}
              x={x}
              y={row * rowHeight}
              width={w}
              height={rowHeight}
              fill={BRAND.ink}
            />
          ) : null

          x += w

          return rect
        })
      })}
    </svg>
  )
}

// A phone outline, enough to say "this is on your phone" without
// skeuomorphic chrome: an iPhone-style island for Apple Wallet, a
// punch-hole camera for Google Wallet on Android.
export function PhoneFrame({
  platform = 'apple',
  children,
}: {
  platform?: WalletPlatform
  children: React.ReactNode
}) {
  const android = platform === 'google'

  return (
    <div
      className={`relative mx-auto w-full max-w-[330px] bg-ink-900 p-[11px] shadow-[0_40px_80px_-30px_rgb(14_26_77/0.55)] ${android ? 'rounded-[36px]' : 'rounded-[46px]'}`}
    >
      <div
        className={`relative flex min-h-[560px] flex-col px-3.5 pt-14 pb-6 ${android ? 'rounded-[26px] bg-white' : 'rounded-[36px] bg-[#f2f2f7]'}`}
      >
        <div
          aria-hidden
          className={`absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-900 ${android ? 'size-3.5' : 'h-[26px] w-[92px]'}`}
        />
        {children}
      </div>
    </div>
  )
}
