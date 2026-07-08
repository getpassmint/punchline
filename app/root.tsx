import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { Route } from './+types/root'
import './app.css'

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap',
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
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-paper-200 text-espresso-900 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-5xl font-bold">{message}</h1>
      <p className="text-espresso-600">{details}</p>
      <a href="/" className="text-stampred-500 underline underline-offset-4">
        Back to the café
      </a>
    </main>
  )
}
