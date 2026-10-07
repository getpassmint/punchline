import { pauseLiveData } from '../hooks/use-live-data'
import type { Device } from '../lib/device'
import type { Card } from '../lib/loyalty.server'

// The official "Add to Apple/Google Wallet" badges, linking to Passmint's
// direct links (or its hosted page if a platform wasn't delivered). Phones
// see only their own wallet's badge.
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
          // Google's save page has no way back to the site.
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
