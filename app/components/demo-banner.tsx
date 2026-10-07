// Says up front that the café is made up and the product is real.
export function DemoBanner() {
  return (
    <div className="bg-ink-900 px-5 py-2.5 text-center text-sm text-white sm:px-8">
      <span>
        Punchline is a made-up café: a live demo of Passmint, the API for Apple and Google Wallet
        passes.
      </span>{' '}
      <a
        href="https://passmint.com"
        className="whitespace-nowrap font-semibold text-butter-400 underline decoration-butter-400/50 underline-offset-4 hover:decoration-butter-400"
      >
        Learn about Passmint
      </a>
    </div>
  )
}
