import { Form, useNavigation } from 'react-router'
import { StampRow } from '../components/stamp-row'
import { cloudflareContext } from '../context'
import { listRecentCards, redeemCard, stampCard } from '../lib/loyalty.server'
import { PassmintAPIError, STAMP_GOAL } from '../lib/passmint.server'
import type { Route } from './+types/counter'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'The counter — Tenthcup' }]
}

// TODO: optionally gate this page behind a single shared demo PIN. Left
// open for now — anyone with the URL can stamp cards, fine for a demo.
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)

  return { cards: await listRecentCards(env), goal: STAMP_GOAL }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext)
  const form = await request.formData()
  const cardId = String(form.get('cardId') ?? '')
  const intent = String(form.get('intent') ?? '')

  try {
    // Both transitions push the update to the customer's phone via Passmint.
    const card =
      intent === 'stamp'
        ? await stampCard(env, cardId)
        : intent === 'redeem'
          ? await redeemCard(env, cardId)
          : undefined

    if (card === null) {
      return { error: "That card doesn't exist anymore." }
    }

    return null
  } catch (err) {
    if (err instanceof PassmintAPIError) {
      return { error: `Passmint rejected the update: ${err.message}` }
    }

    throw err
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)

  if (seconds < 60) {
    return 'just now'
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return `${Math.floor(seconds / 86400)}d ago`
}

export default function Counter({ loaderData, actionData }: Route.ComponentProps) {
  const { cards, goal } = loaderData
  const navigation = useNavigation()
  const busyCardId = navigation.state !== 'idle' ? navigation.formData?.get('cardId') : undefined

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-14">
      <header>
        <h1 className="font-display text-4xl font-bold lowercase tracking-tight">the counter</h1>
        <p className="mt-2 text-espresso-600">
          Barista view — stamp a card as the coffee is poured, and the pass updates on the
          customer's phone.
        </p>
      </header>

      {actionData?.error && (
        <p className="mt-6 rounded-xl bg-stampred-50 px-4 py-3 text-sm text-stampred-600">
          {actionData.error}
        </p>
      )}

      {cards.length === 0 ? (
        <p className="mt-10 rounded-3xl bg-foam-50 p-8 text-center text-espresso-600">
          No cards yet. Scan the code on the{' '}
          <a href="/" className="underline underline-offset-4">
            landing page
          </a>{' '}
          to issue the first one.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {cards.map((card) => {
            const busy = busyCardId === card.id
            const earned = card.state === 'reward'

            return (
              <li
                key={card.id}
                className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl p-5 shadow-sm shadow-paper-300 ${
                  earned ? 'bg-stampred-50' : 'bg-foam-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm">{card.shortId}</span>
                    <span className="text-xs text-espresso-500" suppressHydrationWarning>
                      {timeAgo(card.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StampRow count={card.stampCount} goal={goal} state={card.state} size="sm" />
                    <span className="font-display text-sm font-bold">
                      {card.stampCount}/{goal}
                    </span>
                  </div>
                </div>
                <Form method="post">
                  <input type="hidden" name="cardId" value={card.id} />
                  <input type="hidden" name="intent" value={earned ? 'redeem' : 'stamp'} />
                  <button
                    type="submit"
                    disabled={busy}
                    className={`min-w-24 rounded-xl px-5 py-2.5 font-medium text-foam-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
                      earned
                        ? 'bg-stampred-500 hover:bg-stampred-600 focus-visible:outline-espresso-900'
                        : 'bg-espresso-900 hover:bg-espresso-800 focus-visible:outline-stampred-500'
                    }`}
                  >
                    {busy ? '…' : earned ? 'Redeem' : 'Stamp'}
                  </button>
                </Form>
              </li>
            )
          })}
        </ul>
      )}

      <footer className="mt-auto pt-14 text-sm text-espresso-500">
        Cards reset to zero on redeem, so the loop never ends.
      </footer>
    </main>
  )
}
