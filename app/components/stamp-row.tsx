import type { CSSProperties } from 'react'

// The café's hand-stamped coffee mark, tinted to the current ink colour.
const STAMP_MASK: CSSProperties = {
  maskImage: 'url(/stamp-mask.png)',
  WebkitMaskImage: 'url(/stamp-mask.png)',
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
  backgroundColor: 'currentColor',
}

// Deterministic 0..1 from a slot index + seed. Deterministic so the server
// and client render the same stamp (no hydration mismatch), while each slot
// still gets its own rotation, offset and ink density — so a stamped card
// reads as hand-pressed rather than printed.
function jitter(i: number, seed: number): number {
  const n = Math.sin((i + 1) * seed) * 10000

  return n - Math.floor(n)
}

export function StampRow({
  count,
  goal,
  state,
  justStamped = false,
  size = 'lg',
  decorative = false,
}: {
  count: number
  goal: number
  state: 'active' | 'reward'
  justStamped?: boolean
  size?: 'lg' | 'sm'
  /** Brand ornament, not data — hides the row from assistive tech. */
  decorative?: boolean
}) {
  const px = size === 'lg' ? 'size-9' : 'size-3'
  const ink = state === 'reward' ? 'text-stampred-500' : 'text-espresso-800'

  return (
    <div
      className={size === 'lg' ? 'grid w-fit grid-cols-5 gap-2' : 'flex gap-1'}
      role="img"
      aria-hidden={decorative || undefined}
      aria-label={
        decorative
          ? undefined
          : `${count} of ${goal} stamps${state === 'reward' ? ' — free coffee earned' : ''}`
      }
    >
      {Array.from({ length: goal }, (_, i) => {
        const filled = i < count

        if (!filled) {
          const rim = i === goal - 1 ? 'border-stampred-500/50' : 'border-espresso-800/30'

          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
              key={i}
              className={`${px} rounded-full border-2 border-dotted ${rim}`}
            />
          )
        }

        // Small rows (the top motif line, the counter) stay straight and
        // simple; only the big card gets the hand-stamped coffee mark.
        if (size === 'sm') {
          const fill = state === 'reward' ? 'bg-stampred-500' : 'bg-espresso-800'

          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
              key={i}
              className={`${px} rounded-full ${fill}`}
            />
          )
        }

        const newest = justStamped && i === count - 1
        const rot = Math.round((jitter(i, 12.9) * 2 - 1) * 16)
        const tx = ((jitter(i, 78.23) * 2 - 1) * 3).toFixed(2)
        const ty = ((jitter(i, 37.71) * 2 - 1) * 3).toFixed(2)

        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable row
            key={i}
            className={`${px} ${ink} ${newest ? 'stamp-pop' : ''}`}
            style={
              {
                ...STAMP_MASK,
                // Uneven ink: some presses land heavier than others.
                opacity: 0.8 + jitter(i, 9.11) * 0.2,
                '--stamp-rot': `${rot}deg`,
                '--stamp-tx': `${tx}px`,
                '--stamp-ty': `${ty}px`,
                transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
