import { useEffect, useState } from 'react'

// Whether this browser has added the card to a wallet: set when the visitor
// taps an add button (or "I've added it"), remembered per card. Webhooks give
// the real answer when configured; this covers the page without them.
export function useAddedToWallet(cardId: string | undefined) {
  const key = cardId && `punchline:added:${cardId}`
  const [added, setAdded] = useState(false)

  useEffect(() => {
    try {
      setAdded(key ? localStorage.getItem(key) === '1' : false)
    } catch {
      setAdded(false)
    }
  }, [key])

  const markAdded = () => {
    try {
      if (key) {
        localStorage.setItem(key, '1')
      }
    } catch {
      // Storage blocked (private mode): remember for this page view only.
    }

    setAdded(true)
  }

  return [added, markAdded] as const
}
