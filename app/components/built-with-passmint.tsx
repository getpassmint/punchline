import { GitHubMark } from './github-mark'

// What the demo is for: the café is made up; the pass, its updates and the
// delivery receipts are Passmint.
export function BuiltWithPassmint() {
  return (
    <section className="mb-12 grid gap-8 border-t border-ink-900/10 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <div>
        <h2 className="type-wide text-3xl leading-tight">Built with Passmint</h2>
        <p className="mt-3 max-w-md text-ink-600">
          Punchline is a made-up café. Everything that happens to the pass is real, and runs on
          Passmint: one API for Apple and Google Wallet passes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://passmint.com"
            className="rounded-full bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-ink-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
          >
            Try Passmint
          </a>
          <a
            href="https://github.com/getpassmint/punchline"
            className="flex items-center gap-2 rounded-full border border-ink-900/15 bg-white px-5 py-2.5 font-semibold text-ink-900 hover:border-ink-900/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
          >
            <GitHubMark />
            View source
          </a>
        </div>
      </div>
      <dl className="grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Issue</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Scanning the code makes one <code className="text-ink-900">passes.create()</code> call.
            Passmint signs the pass and hosts the add-to-wallet page.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Update</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Each punch is one <code className="text-ink-900">passes.update()</code>. Passmint
            re-signs it, swaps the strip art and pushes it to the phone.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Hear back</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Webhooks report when the pass lands in a wallet and when the phone picks up each update.
          </dd>
        </div>
      </dl>
    </section>
  )
}
