import { Form, useNavigation } from 'react-router'
import { PassStrip } from '../components/pass-strip'
import { SiteHeader } from '../components/site-header'
import { WalletStatus } from '../components/wallet-status'
import { cloudflareContext } from '../context'
import { useLiveData } from '../hooks/use-live-data'
import { timeAgo } from '../lib/format'
import {
  type Card,
  getCardByShortId,
  listSessionCards,
  redeemCard,
  stampCard,
} from '../lib/loyalty.server'
import { applyIntent } from '../lib/optimistic'
import { describePassmintError } from '../lib/passmint.server'
import { STAMP_GOAL } from '../lib/rules'
import { readSession } from '../lib/session.server'
import type { Route } from './+types/counter'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'The counter · Punchline' }]
}

// The till. It shows the cards on this browser, plus any card looked up by
// the code under its barcode, the way a real till scans a pass. It never
// lists other visitors' cards: this is a public demo.
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)
  const sessionId = await readSession(request)
  const code = new URL(request.url).searchParams.get('code')?.trim() ?? ''
  const cards: Card[] = sessionId ? await listSessionCards(env, sessionId) : []
  const lookedUp = code ? await getCardByShortId(env, code) : null

  if (lookedUp && !cards.some((c) => c.id === lookedUp.id)) {
    cards.unshift(lookedUp)
  }

  return {
    cards,
    code,
    notFound: code !== '' && lookedUp === null,
    sessionId,
    walletTracking: Boolean(env.PASSMINT_WEBHOOK_SECRET),
  }
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
        ? await stampCard(env, cardId, 'counter')
        : intent === 'redeem'
          ? await redeemCard(env, cardId, 'counter')
          : undefined

    if (card === null) {
      return { error: "That card doesn't exist anymore." }
    }

    return null
  } catch (err) {
    const message = describePassmintError(err)

    if (message) {
      return { error: message }
    }

    throw err
  }
}

export default function Counter({ loaderData, actionData }: Route.ComponentProps) {
  const { cards, code, notFound, sessionId, walletTracking } = loaderData
  const navigation = useNavigation()

  // New scans and punches from customers' own phones appear without a reload.
  useLiveData(3000)
  // The row being punched or redeemed shows its outcome straight away.
  const pending = navigation.state !== 'idle' && navigation.formMethod === 'POST'
  const busyCardId = pending ? navigation.formData?.get('cardId') : undefined
  const busyIntent = pending ? navigation.formData?.get('intent') : undefined

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 py-8 lg:py-12">
        <div>
          <h1 className="type-wide text-4xl sm:text-5xl">The counter</h1>
          <p className="mt-3 max-w-lg text-lg text-ink-600">
            This is what the barista sees. A real till scans the code on the pass. Here you get the
            card on this browser, or you can look one up by the code under its barcode. Punch it and
            the pass updates on the customer's phone.
          </p>
        </div>

        <Form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Card code</span>
            <input
              name="code"
              defaultValue={code}
              placeholder="e.g. tEDWE4TTIhdE"
              autoComplete="off"
              spellCheck={false}
              className="rounded-xl border border-ink-900/15 bg-white px-4 py-2.5 tabular-nums outline-none focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-500/20"
            />
          </label>
          <button
            type="submit"
            className="rounded-full border border-ink-900/15 bg-white px-5 py-2.5 font-semibold hover:border-ink-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
          >
            Look up
          </button>
        </Form>

        {notFound && (
          <p role="status" className="text-sm text-ink-600">
            No card has the code "{code}". Check the characters under the barcode on the pass.
          </p>
        )}

        {actionData?.error && (
          <p role="alert" className="rounded-xl bg-cherry-50 px-4 py-3 text-sm text-cherry-600">
            {actionData.error}
          </p>
        )}

        {cards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-400/40 p-8 text-ink-600">
            This browser has no card yet. Get one on the{' '}
            <a href="/" className="font-semibold text-cobalt-500 underline underline-offset-4">
              home page
            </a>
            , or look one up by its code above.
          </p>
        ) : (
          // biome-ignore lint/a11y/noRedundantRoles: WebKit drops list semantics from a `display: flex` <ul>, so VoiceOver stops announcing the card count; the explicit role puts it back.
          <ul role="list" className="flex flex-col gap-3">
            {cards.map((saved) => {
              const busy = busyCardId === saved.id
              const card = busy ? applyIntent(saved, busyIntent) : saved
              const earned = card.state === 'reward'
              const yours = sessionId !== null && card.sessionId === sessionId

              return (
                <li
                  key={card.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgb(14_26_77/0.06)] sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:gap-x-5 sm:pr-4 ${
                    earned ? 'ring-2 ring-butter-400' : ''
                  }`}
                >
                  <PassStrip
                    count={card.stampCount}
                    state={card.state}
                    className="col-span-2 h-auto w-full rounded-lg sm:col-span-1"
                  />
                  <div className="min-w-0 pl-1 sm:pl-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-semibold tabular-nums">
                        {card.stampCount} / {STAMP_GOAL}
                      </span>
                      {card.shortId && (
                        <span className="min-w-0 truncate text-sm text-ink-400 tabular-nums">
                          {card.shortId}
                        </span>
                      )}
                      {yours && (
                        <span className="whitespace-nowrap rounded-full bg-cobalt-50 px-2 py-0.5 text-xs font-semibold text-cobalt-600">
                          Your card
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-ink-400" suppressHydrationWarning>
                      {earned ? 'Free coffee to redeem · ' : ''}
                      {timeAgo(card.updatedAt)}
                    </div>
                    {walletTracking && (
                      <div className="mt-1.5">
                        <WalletStatus card={card} size="sm" />
                      </div>
                    )}
                  </div>
                  {card.issueState === 'ready' ? (
                    <Form method="post">
                      <input type="hidden" name="cardId" value={card.id} />
                      <input type="hidden" name="intent" value={earned ? 'redeem' : 'stamp'} />
                      <button
                        type="submit"
                        disabled={busy}
                        className={`h-12 min-w-24 rounded-full px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
                          earned
                            ? 'bg-butter-400 text-ink-900 hover:bg-butter-600 focus-visible:outline-cobalt-500'
                            : 'bg-cobalt-500 text-white hover:bg-cobalt-600 focus-visible:outline-butter-400'
                        }`}
                      >
                        {busy ? 'Sending…' : earned ? 'Redeem' : 'Punch'}
                      </button>
                    </Form>
                  ) : (
                    <span className="text-sm font-medium text-ink-400">
                      {card.issueState === 'issuing' ? 'Issuing…' : "Couldn't issue"}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-sm text-ink-400">
          Redeeming resets a card to zero, so every card can go round again.
        </p>
      </main>
    </div>
  )
}
