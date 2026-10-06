import { useEffect } from 'react'
import { useNavigation, useRevalidator } from 'react-router'

// Re-runs the route's loaders every `intervalMs` while the tab is visible,
// and immediately when it becomes visible again. It's what keeps the laptop,
// the phone and the counter in step without a socket: stamps from any one of
// them show up on the others within a couple of seconds. Plain polling is
// plenty for a demo; a real till would push over a WebSocket or SSE.
export function useLiveData(intervalMs: number) {
  const { revalidate, state } = useRevalidator()
  const navigation = useNavigation()
  const busy = state !== 'idle' || navigation.state !== 'idle'

  useEffect(() => {
    if (busy) {
      return
    }

    const tick = () => {
      if (document.visibilityState === 'visible') {
        revalidate()
      }
    }

    const timer = window.setInterval(tick, intervalMs)

    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [busy, intervalMs, revalidate])
}
