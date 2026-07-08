import { createRequestHandler, RouterContextProvider } from 'react-router'
import { cloudflareContext } from '../app/context'

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
)

export default {
  async fetch(request, env, ctx) {
    // Chrome DevTools probes this on every page load; answer quietly so it
    // doesn't spam the router with "no route matches" 404s.
    if (new URL(request.url).pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
      return new Response(null, { status: 204 })
    }

    const context = new RouterContextProvider()

    context.set(cloudflareContext, { env, ctx })

    return requestHandler(request, context)
  },
} satisfies ExportedHandler<Env>
