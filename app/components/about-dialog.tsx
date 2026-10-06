import { useRef } from 'react'
import { PassmintMark } from './passmint-mark'

const STEPS = [
  {
    title: 'Scan the code',
    body: 'A new card is issued straight to your wallet. No sign-up.',
  },
  {
    title: 'Buy a coffee',
    body: 'The till punches the card. Passmint re-signs the pass and pushes it to your phone, which redraws it on its own.',
  },
  {
    title: 'Redeem',
    body: 'The ninth punch unlocks a free coffee. Redeeming it starts the card again.',
  },
]

export function AboutDialog({ className }: { className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={className}>
        How it works
      </button>

      {/* Native <dialog>: focus trapping and Escape-to-close come for free.
          The backdrop-click dismissal below is enhancement — keyboard users
          have Escape and the Close button. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal is enhancement; Escape and Close cover keyboards */}
      <dialog
        ref={ref}
        aria-labelledby="about-title"
        onClick={(e) => {
          if (e.target === ref.current) {
            ref.current?.close()
          }
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/60"
      >
        <div className="flex flex-col gap-6 p-7">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h2 id="about-title" className="type-wide text-2xl">
                What's Punchline?
              </h2>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close"
                className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-xl leading-none text-ink-400 hover:bg-milk hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
              >
                ×
              </button>
            </div>
            <p className="mt-2 leading-relaxed text-ink-600">
              A made-up café whose punch card lives in Apple or Google Wallet, and an open-source
              demo of Passmint, small enough to read in one sitting.
            </p>
          </div>

          <ol className="flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3.5">
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-butter-400 font-bold text-ink-900 tabular-nums shadow-[inset_0_2px_0_rgb(216_174_31)]"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="rounded-2xl bg-milk px-4 py-3 text-sm leading-relaxed text-ink-600">
            A real café punches from its till. Here, the "Buy a coffee" button and the Counter page
            stand in for it: press it on your laptop and watch your phone.
          </p>

          <div className="flex flex-col gap-4 rounded-2xl bg-ink-900 p-5 text-white sm:flex-row sm:items-center">
            <div className="flex-1">
              <PassmintMark className="text-white" />
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Passmint is one API for Apple and Google Wallet passes. It handles the certificates,
                the signing and the push that updates a pass already on someone's phone. Punchline
                only keeps count.
              </p>
            </div>
            {/* TODO: confirm the final Passmint marketing URL. */}
            <a
              href="https://passmint.com"
              className="shrink-0 self-start rounded-full bg-butter-400 px-5 py-2.5 font-semibold text-ink-900 hover:bg-butter-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-center"
            >
              Try Passmint
            </a>
          </div>
        </div>
      </dialog>
    </>
  )
}
