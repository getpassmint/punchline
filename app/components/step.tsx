type StepState = 'done' | 'current' | 'available' | 'upcoming'

// One step of the home page's walkthrough. Done steps collapse to a line with
// a check, the current one is highlighted, and later ones wait their turn.
export function Step({
  n,
  title,
  state,
  summary,
  children,
}: {
  n: number
  title: string
  state: StepState
  summary?: React.ReactNode
  children?: React.ReactNode
}) {
  const open = state === 'current' || state === 'available'

  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className={`rounded-2xl ${
        open ? 'bg-white p-5 shadow-[0_1px_2px_rgb(14_26_77/0.06)]' : 'px-5 py-2.5'
      } ${state === 'current' ? 'ring-2 ring-cobalt-500/25' : ''} ${
        state === 'upcoming' ? 'opacity-50' : ''
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
        <span
          aria-hidden="true"
          className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${
            state === 'done'
              ? 'bg-leaf-600 text-white'
              : open
                ? 'bg-butter-400 text-ink-900'
                : 'border border-ink-400/60 text-ink-400'
          }`}
        >
          {state === 'done' ? (
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
              <path
                d="M3 8.5 6.5 12 13 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            n
          )}
        </span>
        <h3 className={`whitespace-nowrap font-semibold ${state === 'done' ? 'text-ink-600' : ''}`}>
          <span className="sr-only">
            Step {n}
            {state === 'done' ? ', done' : ''}:{' '}
          </span>
          {title}
        </h3>
        {state === 'done' && summary && (
          <span className="w-full pl-10 text-sm text-ink-400 sm:ml-auto sm:w-auto sm:pl-0">
            {summary}
          </span>
        )}
      </div>
      {open && children && <div className="mt-4 sm:pl-10">{children}</div>}
    </li>
  )
}
