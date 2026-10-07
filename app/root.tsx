import { useEffect } from 'react'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRevalidator,
} from 'react-router'
import type { Route } from './+types/root'
import { DemoBanner } from './components/demo-banner'
import './app.css'

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Light-only: auto-dark modes can make the QR unscannable. */}
        <meta name="color-scheme" content="light" />
        {/* Matches the demo banner, so the phone's browser chrome blends in. */}
        <meta name="theme-color" content="#0e1a4d" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-milk font-sans text-ink-900 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  // The share-image page is screenshotted as-is, so it gets no banner.
  const { pathname } = useLocation()

  return (
    <>
      {pathname !== '/og' && <DemoBanner />}
      <Outlet />
    </>
  )
}

// A request the browser dropped (Safari cancels in-flight requests while it
// hands a .pkpass to the Wallet sheet, or the phone briefly loses signal).
// Not a real failure, so retry quietly instead of showing an error page.
function isDroppedRequest(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /load failed|failed to fetch|networkerror|network connection/i.test(error.message)
  )
}

function Reconnecting() {
  const { revalidate } = useRevalidator()

  useEffect(() => {
    const timer = window.setTimeout(revalidate, 1500)

    return () => window.clearTimeout(timer)
  }, [revalidate])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-6">
      <p className="type-wide text-2xl">Reconnecting…</p>
      <p className="text-ink-600">Lost the connection for a moment. Picking up where you were.</p>
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isDroppedRequest(error)) {
    return <Reconnecting />
  }

  let message = 'Something spilled'
  let details = 'An unexpected error occurred.'

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : `${error.status}`

    details =
      error.status === 404 ? "That page isn't on the menu." : (error.data ?? error.statusText)
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="type-wide text-5xl">{message}</h1>
      <p className="text-lg text-ink-600">{details}</p>
      <a
        href="/"
        className="w-fit font-semibold text-cobalt-500 underline decoration-2 underline-offset-4"
      >
        Back to Punchline
      </a>
    </main>
  )
}
