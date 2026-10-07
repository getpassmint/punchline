import { useEffect } from 'react'
import { useNavigation, useRevalidator } from 'react-router'

// Re-runs the route's loaders every `intervalMs` while the tab is visible.
// Plain polling keeps the laptop, phone and counter in step; a real till
// would push over a WebSocket instead.
//
// Polling pauses while the page is being left: Safari cancels in-flight
// requests when it hands a .pkpass to the Wallet sheet.
let pausedUntil = 0

export function pauseLiveData(ms: number) {
  pausedUntil = Math.max(pausedUntil, Date.now() + ms)
}

export function useLiveData(intervalMs: number) {
  const { revalidate, state } = useRevalidator()
  const navigation = useNavigation()
  const busy = state !== 'idle' || navigation.state !== 'idle'

  useEffect(() => {
    if (busy) {
      return
    }

    const tick = () => {
      if (document.visibilityState === 'visible' && Date.now() >= pausedUntil) {
        revalidate()
      }
    }
    const onPageHide = () => pauseLiveData(15_000)

    const timer = window.setInterval(tick, intervalMs)

    document.addEventListener('visibilitychange', tick)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [busy, intervalMs, revalidate])
}
