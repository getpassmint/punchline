import { pauseLiveData } from '../hooks/use-live-data'
import type { Device } from '../lib/device'
import type { Card } from '../lib/loyalty.server'

// Official "Add to Apple/Google Wallet" badges. Each points at Passmint's
// direct link for that platform, falling back to the hosted `url` page (which
// detects the platform itself) when a platform wasn't delivered. An iPhone
// only gets the Apple badge and an Android phone only the Google one; anything
// else sees both.
export function WalletButtons({
  card,
  device,
  onAdd,
}: {
  card: Card
  device: Device
  onAdd?: () => void
}) {
  const appleHref = card.downloadUrl ?? card.url ?? undefined
  const googleHref = card.googleWalletUrl ?? card.url ?? undefined

  // A fragment, not a wrapper: the badges sit in the caller's action row as
  // siblings of the punch button.
  return (
    <>
      {device !== 'android' && (
        <a
          href={appleHref}
          onClick={() => {
            pauseLiveData(15_000)
            onAdd?.()
          }}
          className="flex shrink-0 justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
        >
          <img src="/badges/apple-wallet.svg" alt="Add to Apple Wallet" className="h-12 w-auto" />
        </a>
      )}
      {device !== 'ios' && (
        <a
          href={googleHref}
          // Google's save page has no way back to the site, so keep
          // Punchline open in this tab.
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            pauseLiveData(15_000)
            onAdd?.()
          }}
          className="flex shrink-0 justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
        >
          <img src="/badges/google-wallet.svg" alt="Add to Google Wallet" className="h-12 w-auto" />
        </a>
      )}
    </>
  )
}
