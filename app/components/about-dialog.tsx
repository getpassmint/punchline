import { useRef } from 'react'

// Passmint's brand lockup: the mark beside the wordmark.
function PassmintMark() {
  return (
    <span className="inline-flex items-center gap-2 text-[#14161c]">
      <svg viewBox="0 0 68 93" fill="none" aria-hidden className="h-5 w-auto shrink-0">
        <title>Passmint</title>
        <path
          d="M40.55 46.13c.001-2.39-.011-4.71.012-7.02.008-.77-.26-1.3-.94-1.69-3.81-2.18-7.61-4.38-11.41-6.57-.21-.12-.44-.21-.69-.32-.31.4-.19.82-.19 1.21-.01 19.59 0 39.18 0 58.78 0 .25.01.5 0 .74-.09 1.49-1.33 2.18-2.63 1.44-1.85-1.05-3.67-2.15-5.5-3.23-5.91-3.5-11.82-7.03-17.75-10.49-1.03-.6-1.45-1.31-1.44-2.51.03-19.56.02-39.13.02-58.69 0-.36-.02-.73.06-1.07.27-1.06 1.43-1.45 2.55-.83 2.07 1.16 4.12 2.36 6.18 3.54 5.65 3.24 11.3 6.49 16.95 9.73.35.2.68.47 1.11.54.32-.3.18-.68.18-1.02.01-8.83.01-17.67.01-26.5 0-.59.02-1.16.44-1.63.55-.62 1.31-.72 2.19-.22 2.72 1.57 5.37 3.1 8.03 4.63 9.39 5.39 18.75 10.81 28.17 16.13 1.57.89 2.18 1.92 2.16 3.73-.09 8.94-.06 17.89-.02 26.83.01 1.37-.46 2.22-1.68 2.91-7.61 4.31-15.19 8.7-22.78 13.05-1.73.99-2.93.32-2.95-1.68-.04-3.58-.02-7.15-.02-10.73 0-2.97.01-5.94.01-9Z"
          fill="currentColor"
        />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">Passmint</span>
    </span>
  )
}

export function AboutDialog() {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="underline underline-offset-4 hover:text-espresso-800"
      >
        How it works
      </button>

      {/* Native <dialog>: focus trapping and Escape-to-close come for free.
          The backdrop-click dismissal below is enhancement — keyboard users
          have Escape and the Close button. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal is enhancement; Escape and Close cover keyboards */}
      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) {
            ref.current?.close()
          }
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-foam-50 p-0 text-espresso-900 shadow-xl backdrop:bg-espresso-900/40"
      >
        {/* text-left resets the centering inherited from the footer this
            dialog is nested in. */}
        <div className="flex flex-col gap-6 p-8 text-left">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl font-bold lowercase">what's tenthcup?</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="-mr-1 -mt-1 rounded-full px-2 py-0.5 text-xl text-espresso-500 hover:bg-paper-200 hover:text-espresso-900"
            >
              ×
            </button>
          </div>

          <p className="text-sm leading-relaxed text-espresso-600">
            Tenthcup is a fictional café whose loyalty card lives in Apple and Google Wallet instead
            of your pocket. Buy nine coffees and the tenth is on us. It's an open-source demo of
            Passmint — the whole thing is a couple hundred lines you can read in one sitting.
          </p>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-espresso-500">
              How it works
            </h3>
            <ol className="mt-3 flex flex-col gap-2 text-sm text-espresso-600">
              <li>
                <span className="font-semibold text-espresso-900">Scan</span> the code and a fresh
                card lands in your wallet — no sign-up.
              </li>
              <li>
                Buy a coffee and the till adds a{' '}
                <span className="font-semibold text-espresso-900">stamp</span> — the pass on your
                phone updates on the spot, by push.
              </li>
              <li>
                The ninth stamp unlocks your free coffee;{' '}
                <span className="font-semibold text-espresso-900">redeeming</span> it resets the
                card for another round.
              </li>
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-espresso-500">
              A real café would wire the stamp into its point-of-sale, so it fires automatically
              when a coffee is rung up. This demo's counter page and “simulate a visit” button stand
              in for that till.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-espresso-500">
              What's Passmint?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-espresso-600">
              Passmint issues and updates Apple and Google Wallet passes over one API — handling
              certificates, signing, and the push that refreshes a pass already on someone's phone.
              Tenthcup just tracks a stamp count and asks Passmint to push it.
            </p>
            {/* TODO: confirm the final Passmint marketing URL. */}
            <a
              href="https://passmint.com"
              className="mt-4 inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stampred-500"
            >
              <PassmintMark />
            </a>
          </div>
        </div>
      </dialog>
    </>
  )
}
