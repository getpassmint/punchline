import type { Card } from '../lib/loyalty.server'

// Official "Add to Apple/Google Wallet" badges. Each points at Passmint's
// direct link for that platform, falling back to the hosted `url` page (which
// detects the platform itself) when a platform wasn't delivered.
export function WalletButtons({ card }: { card: Card }) {
  const appleHref = card.downloadUrl ?? card.url
  const googleHref = card.googleWalletUrl ?? card.url

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-3">
      <a
        href={appleHref}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stampred-500"
      >
        <img src="/badges/apple-wallet.svg" alt="Add to Apple Wallet" className="h-12 w-auto" />
      </a>
      <a
        href={googleHref}
        className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stampred-500"
      >
        <img src="/badges/google-wallet.svg" alt="Add to Google Wallet" className="h-12 w-auto" />
      </a>
    </div>
  )
}
