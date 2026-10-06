import { BRAND } from '../lib/brand'
import { type CardState, STAMP_GOAL } from '../lib/rules'

/**
 * The strip box Passmint fits strip images into, in points. Drawing at exactly
 * this shape means nothing gets letterboxed when the template is set up.
 */
export const STRIP_WIDTH = 375
export const STRIP_HEIGHT = 98

const COLS = 5
const RADIUS = 17
const GAP_X = 52
const ROWS_Y = [27, 71]

// The card's strip art: ten punch slots, punched ones showing butter through
// the hole with a bean in it, and the tenth slot a cup. One component serves
// twice — the live replica on the web page, and (rendered to PNG by
// scripts/setup-pass.tsx) the strip images Passmint swaps onto the real
// pass with each punch.
export function PassStrip({
  count,
  state,
  newest = false,
  className,
}: {
  count: number
  state: CardState
  /** Animate the most recent punch (web only). */
  newest?: boolean
  className?: string
}) {
  const startX = (STRIP_WIDTH - GAP_X * (COLS - 1)) / 2

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
      width={STRIP_WIDTH}
      height={STRIP_HEIGHT}
      className={className}
      role="img"
      aria-label={`${count} of ${STAMP_GOAL} punches${state === 'reward' ? ', free coffee earned' : ''}`}
    >
      <rect width={STRIP_WIDTH} height={STRIP_HEIGHT} fill={BRAND.cobalt} />
      {Array.from({ length: STAMP_GOAL }, (_, i) => {
        const cx = startX + (i % COLS) * GAP_X
        const cy = ROWS_Y[Math.floor(i / COLS)] ?? 0
        const last = i === STAMP_GOAL - 1

        if (last) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
            <CupSlot key={i} cx={cx} cy={cy} earned={state === 'reward'} />
          )
        }

        return i < count ? (
          <Punched
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
            key={i}
            cx={cx}
            cy={cy}
            seed={i}
            animate={newest && i === count - 1}
          />
        ) : (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
            key={i}
            cx={cx}
            cy={cy}
            r={RADIUS - 1}
            fill="none"
            stroke={BRAND.white}
            strokeOpacity={0.38}
            strokeWidth={2}
            strokeDasharray="3 4"
          />
        )
      })}
    </svg>
  )
}

function Punched({
  cx,
  cy,
  seed,
  animate,
}: {
  cx: number
  cy: number
  seed: number
  animate: boolean
}) {
  // Each bean sits at its own angle, so a full card reads as hand-punched.
  const tilt = ((seed * 47) % 60) - 30

  return (
    // The animation scales an inner group: a CSS transform on the outer one
    // would replace its translate and fling the hole to the corner.
    <g transform={`translate(${cx} ${cy})`}>
      <g className={animate ? 'punch-in' : undefined}>
        {/* The hole: butter showing through, with a shadowed upper rim. */}
        <circle r={RADIUS} fill={BRAND.butter} />
        <path
          d={`M ${-RADIUS} 0 A ${RADIUS} ${RADIUS} 0 0 1 ${RADIUS} 0 A ${RADIUS} ${RADIUS - 3} 0 0 0 ${-RADIUS} 0 Z`}
          fill={BRAND.butterDeep}
        />
        <g transform={`rotate(${tilt})`}>
          <ellipse rx={6.5} ry={9} fill={BRAND.ink} />
          <path
            d="M 0 -8 C -3 -3, 3 3, 0 8"
            fill="none"
            stroke={BRAND.butter}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  )
}

function CupSlot({ cx, cy, earned }: { cx: number; cy: number; earned: boolean }) {
  const ink = earned ? BRAND.ink : BRAND.butter

  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={earned ? 'punch-in' : undefined}>
        {earned ? (
          <circle r={RADIUS + 1} fill={BRAND.butter} />
        ) : (
          <circle
            r={RADIUS - 1}
            fill="none"
            stroke={BRAND.butter}
            strokeOpacity={0.8}
            strokeWidth={2}
          />
        )}
        {/* A takeaway cup: lid, tapered body, sleeve. */}
        <g fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
          <path d="M -7.5 -6 L 7.5 -6 L 5.5 10 L -5.5 10 Z" />
          <path d="M -9 -6 L 9 -6 M -6.5 -9 L 6.5 -9 L 7.5 -6 M -6.5 -9 L -7.5 -6" />
          <path d="M -6.6 0 L 6.6 0 M -6 4.5 L 6 4.5" />
        </g>
      </g>
    </g>
  )
}
