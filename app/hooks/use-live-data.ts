import { useEffect } from 'react'
import { useNavigation, useRevalidator } from 'react-router'

// Re-runs the route's loaders every `intervalMs` while the tab is visible,
// and immediately when it becomes visible again. It's what keeps the laptop,
// the phone and the counter in step without a socket: stamps from any one of
// them show up on the others within a couple of seconds. Plain polling is
// plenty for a demo; a real till would push over a WebSocket or SSE.
//
// Polling pauses while the page is being left or handed off. Tapping "Add to
// Apple Wallet" makes Safari hand the .pkpass to the Wallet sheet, which
// cancels the page's in-flight requests; a poll caught mid-flight would
// surface as an error behind the sheet.
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
