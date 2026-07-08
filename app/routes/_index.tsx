import { Form, Link, useNavigation } from 'react-router'
import { renderSVG } from 'uqr'
import { AboutDialog } from '../components/about-dialog'
import { StampRow } from '../components/stamp-row'
import { WalletButtons } from '../components/wallet-buttons'
import { cloudflareContext } from '../context'
import { cardCookie } from '../lib/card-cookie.server'
import { getCard, stampCard } from '../lib/loyalty.server'
import { PassmintAPIError, REWARD_AT, STAMP_GOAL } from '../lib/passmint.server'
import type { Route } from './+types/_index'

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Tenthcup — ninth's on you, tenth's on us" },
    {
      name: 'description',
      content:
        'A fictional café whose stamp card lives in Apple and Google Wallet. A Passmint reference implementation.',
    },
  ]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)
  const cardId = await cardCookie.parse(request.headers.get('Cookie'))
  const card = typeof cardId === 'string' && cardId ? await getCard(env, cardId) : null
  // The QR encodes this deployment's /scan URL, so dev and prod both work.
  const scanUrl = new URL('/scan', request.url).toString()

  return {
    card,
    goal: STAMP_GOAL,
    rewardAt: REWARD_AT,
    qrSvg: renderSVG(scanUrl, { blackColor: '#33281f', whiteColor: 'transparent' }),
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext)
  const cardId = await cardCookie.parse(request.headers.get('Cookie'))

  if (typeof cardId !== 'string' || !cardId) {
    return { error: 'No card on this browser yet — scan the code first.' }
  }

  try {
    // The self-demo loop: stamp your own card and watch the pass update on
    // your phone — the same transition the counter runs.
    const card = await stampCard(env, cardId)

    if (!card) {
      return {
        error: "That card doesn't exist anymore — scan for a fresh one.",
      }
    }

    return { stampedTo: card.stampCount }
  } catch (err) {
    if (err instanceof PassmintAPIError) {
      return { error: `Passmint rejected the update: ${err.message}` }
    }

    throw err
  }
}

export default function Landing({ loaderData, actionData }: Route.ComponentProps) {
  const { card, goal, rewardAt, qrSvg } = loaderData
  const navigation = useNavigation()
  const stamping = navigation.state === 'submitting'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center px-6 py-14">
      <header className="flex flex-col items-center gap-3">
        <h1 className="font-display text-6xl font-bold lowercase tracking-tight">tenthcup</h1>
        <StampRow count={goal - 1} goal={goal} state="active" size="sm" decorative />
      </header>
      {card === null ? (
        <>
          <p className="mt-10 text-balance text-center text-lg text-espresso-600">
            Scan for your stamp card — ninth coffee's on you, tenth's on us.
          </p>
          <div className="mt-8 w-full rounded-3xl bg-foam-50 p-8 shadow-lg shadow-paper-300">
            <div
              className="mx-auto aspect-square w-full max-w-64 [&_svg]:h-full [&_svg]:w-full"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-6 text-center text-sm text-espresso-500">
              Point your phone's camera at the code
            </p>
          </div>
          <Link to="/scan" className="mt-6 text-stampred-500 underline underline-offset-4">
            Already on your phone? Get your card
          </Link>
        </>
      ) : (
        <>
          <section className="mt-10 w-full rounded-3xl bg-foam-50 p-8 shadow-lg shadow-paper-300">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm uppercase tracking-widest text-espresso-500">Your card</h2>
              <span className="font-mono text-xs text-espresso-500">{card.shortId}</span>
            </div>
            <div className="mt-6 flex justify-center">
              <StampRow
                count={card.stampCount}
                goal={goal}
                state={card.state}
                justStamped={actionData !== undefined && 'stampedTo' in actionData}
              />
            </div>
            <p className="mt-5 text-center font-display text-4xl font-bold">
              {card.stampCount} / {goal}
            </p>
            {card.state === 'reward' ? (
              <p className="mx-auto mt-6 w-fit -rotate-3 border-[5px] border-double border-stampred-500 px-4 py-1.5 text-center font-display font-bold uppercase tracking-[0.2em] text-stampred-500">
                Free coffee earned
              </p>
            ) : (
              <p className="mt-4 text-center text-sm text-espresso-600">
                {rewardAt - card.stampCount} more for a free coffee
              </p>
            )}
          </section>

          {actionData !== undefined && 'error' in actionData && (
            <p className="mt-4 w-full rounded-xl bg-stampred-50 px-4 py-3 text-center text-sm text-stampred-600">
              {actionData.error}
            </p>
          )}

          <WalletButtons card={card} />

          {card.state !== 'reward' && (
            <Form method="post" className="mt-3 w-full">
              <button
                type="submit"
                disabled={stamping}
                className="w-full rounded-2xl bg-stampred-500 px-5 py-3.5 font-medium text-foam-50 hover:bg-stampred-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso-900 disabled:opacity-60"
              >
                {stamping ? 'Stamping…' : 'Simulate a visit'}
              </button>
            </Form>
          )}
          <p className="mt-3 max-w-xs text-center text-xs text-espresso-500">
            {card.state === 'reward'
              ? 'Show this at the counter — redeeming resets the card for another round.'
              : 'Stamps this card and pushes the update straight to the pass on your phone — no barista needed.'}
          </p>

          <Link to="/scan" className="mt-8 text-sm text-espresso-500 underline underline-offset-4">
            Start a fresh card
          </Link>
        </>
      )}
      <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-14 text-center text-sm text-espresso-500">
        <AboutDialog />
        <span aria-hidden>·</span>
        {/* TODO: confirm the public repo URL before launch. */}
        <a
          href="https://github.com/getpassmint/tenthcup.coffee"
          className="underline underline-offset-4 hover:text-espresso-800"
        >
          Source on GitHub
        </a>
      </footer>
    </main>
  )
}
