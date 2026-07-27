import type { Card } from '../lib/loyalty.server'

// Official "Add to Apple/Google Wallet" badges. Each points at Passmint's
// direct link for that platform, falling back to the hosted `url` page (which
// detects the platform itself) when a platform wasn't delivered.
export function WalletButtons({ card }: { card: Card }) {
  const appleHref = card.downloadUrl ?? card.url
  const googleHref = card.googleWalletUrl ?? card.url

  // A fragment, not a wrapper: the badges are siblings of the "Simulate a
  // visit" button inside the caller's action group, so all three share one
  // gap and one width instead of forming a second, differently-sized stack.
  return (
    <>
      <a
        href={appleHref}
        className="flex justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stampred-500"
      >
        <img src="/badges/apple-wallet.svg" alt="Add to Apple Wallet" className="h-12 w-auto" />
      </a>
      <a
        href={googleHref}
        className="flex justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stampred-500"
      >
        <img src="/badges/google-wallet.svg" alt="Add to Google Wallet" className="h-12 w-auto" />
      </a>
    </>
  )
}
