import { useEffect, useRef } from 'react'
import { data, Form, Link, useNavigation } from 'react-router'
import { renderSVG } from 'uqr'
import { ActivityFeed } from '../components/activity-feed'
import { GitHubMark } from '../components/github-mark'
import { PassPreview, PhoneFrame } from '../components/pass-preview'
import { SiteHeader } from '../components/site-header'
import { WalletButtons } from '../components/wallet-buttons'
import { WalletStatus } from '../components/wallet-status'
import { cloudflareContext } from '../context'
import { useLiveData } from '../hooks/use-live-data'
import { BRAND } from '../lib/brand'
import { detectDevice } from '../lib/device'
import {
  completeIssue,
  getSessionCard,
  listActivity,
  redeemCard,
  restartIssue,
  skipToReward,
  stampCard,
} from '../lib/loyalty.server'
import { applyIntent, type FeedItem, pendingActivity } from '../lib/optimistic'
import { describePassmintError, setupProblem } from '../lib/passmint.server'
import { REWARD_AT } from '../lib/rules'
import { ensureSession, readSession } from '../lib/session.server'
import type { Route } from './+types/_index'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Punchline: a punch card that updates itself' },
    {
      name: 'description',
      content:
        'A fictional café whose punch card lives in Apple and Google Wallet and updates itself with every coffee. A Passmint demo.',
    },
  ]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)
  // Minted on first visit so the QR can carry it to the phone.
  const { sessionId, headers } = await ensureSession(request)
  const card = await getSessionCard(env, sessionId)
  const scanPath = `/scan?s=${sessionId}`
  const device = detectDevice(request.headers.get('user-agent'))
  const qr = (path: string) =>
    renderSVG(new URL(path, request.url).toString(), {
      blackColor: BRAND.ink,
      whiteColor: 'transparent',
    })

  return data(
    {
      card,
      activity: card ? await listActivity(env, card.id) : [],
      device,
      setupProblem: setupProblem(env),
      walletTracking: Boolean(env.PASSMINT_WEBHOOK_SECRET),
      scanPath,
      // The QRs encode this deployment's own URLs, so dev and prod both work.
      // Before a card: /scan issues one. After: /join opens the same card on
      // the phone (e.g. after "Start a new card" on the laptop).
      qrSvg: card ? null : qr(scanPath),
      joinQrSvg:
        card?.issueState === 'ready' && device === 'desktop' ? qr(`/join?s=${sessionId}`) : null,
      // Issuing normally takes a second or two. Past 45s the background work
      // has died, so offer a retry instead of a skeleton forever.
      issueStuck:
        card?.issueState === 'issuing' && Date.now() - Date.parse(card.createdAt) > 45_000,
    },
    { headers },
  )
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext)
  const sessionId = await readSession(request)
  const card = sessionId ? await getSessionCard(env, sessionId) : null

  if (!card) {
    return { error: 'This browser has no card yet. Scan the code to get one.' }
  }

  const intent = (await request.formData()).get('intent')

  if (intent === 'retry') {
    if (await restartIssue(env, card.id)) {
      ctx.waitUntil(completeIssue(env, card.id))
    }

    return { ok: true as const }
  }

  if (card.issueState !== 'ready') {
    return { error: 'Your pass is still being issued. Give it a moment.' }
  }

  try {
    // The same transitions the counter runs, so a solo visitor can punch and
    // redeem their own card and watch the pass follow.
    if (intent === 'redeem') {
      await redeemCard(env, card.id, 'visitor')
    } else if (intent === 'skip') {
      await skipToReward(env, card.id, 'visitor')
    } else {
      await stampCard(env, card.id, 'visitor')
    }

    return { ok: true as const }
  } catch (err) {
    const message = describePassmintError(err)

    if (message) {
      return { error: message }
    }

    throw err
  }
}

export default function Landing({ loaderData, actionData }: Route.ComponentProps) {
  const { card, activity, device, qrSvg, joinQrSvg, scanPath, walletTracking, issueStuck } =
    loaderData
  const issuing = card?.issueState === 'issuing' && !issueStuck
  const issueFailed = card?.issueState === 'failed' || issueStuck
  const navigation = useNavigation()
  // A punch, skip or redeem in flight (through the action and the reload
  // after it). The page renders its outcome immediately; see optimistic.ts.
  const pendingIntent =
    navigation.state !== 'idle' && navigation.formMethod === 'POST'
      ? navigation.formData?.get('intent')
      : null
  const pending = pendingIntent != null
  const shown = card && pending ? applyIntent(card, pendingIntent) : card
  const pendingRow = issuing
    ? ({
        id: -2,
        kind: 'issued',
        stampCount: 0,
        actor: 'visitor',
        at: '',
        pending: true,
      } as FeedItem)
    : card && shown
      ? pendingActivity(card, shown, 'visitor')
      : null
  const feed: FeedItem[] = pendingRow ? [pendingRow, ...activity] : activity
  const onPhone = device !== 'desktop'

  // Before pairing, poll fast so the laptop flips to the card the moment the
  // phone scans; after, a little slower to pick up punches from elsewhere.
  // While the pass is issuing, poll every second so it appears the moment
  // Passmint answers.
  useLiveData(issuing ? 1000 : card ? 3000 : 2000)

  // Animate punches and feed rows however they arrive — this tab, the
  // counter, or the paired phone — by diffing against the previous render.
  const previous = useRef({ card: shown, lastActivityId: activity[0]?.id ?? 0 })
  const newPunch =
    shown !== null &&
    previous.current.card?.id === shown.id &&
    shown.stampCount > previous.current.card.stampCount
  const freshIds = new Set(
    previous.current.card?.id === card?.id
      ? feed.filter((a) => a.id > previous.current.lastActivityId || a.pending).map((a) => a.id)
      : [],
  )

  useEffect(() => {
    previous.current = { card: shown, lastActivityId: activity[0]?.id ?? 0 }
  })

  if (loaderData.setupProblem) {
    return (
      <Page>
        <section className="max-w-xl py-16">
          <h1 className="type-wide text-4xl">Almost ready to pour</h1>
          <p className="mt-4 text-lg text-ink-600">{loaderData.setupProblem}</p>
          <p className="mt-2 text-ink-600">
            The "Run it in 5 minutes" section of the README walks through it.
          </p>
        </section>
      </Page>
    )
  }

  const earned = shown?.state === 'reward'
  const count = shown?.stampCount ?? 0
  const error = actionData && 'error' in actionData ? actionData.error : null

  const pass = (
    <PassPreview
      count={count}
      state={shown?.state ?? 'active'}
      serial={card?.shortId ?? '000000000000'}
      newest={newPunch}
      placeholder={!card}
      issuing={issuing}
    />
  )

  return (
    <Page>
      <div className="grid items-start gap-x-16 gap-y-10 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-14">
        {/* The pass: framed in a phone on a laptop, bare on a phone. */}
        <div className="lg:sticky lg:top-6">
          {onPhone ? (
            card && <div className="mx-auto max-w-sm">{pass}</div>
          ) : (
            <PhoneFrame>
              {pass}
              <p className="mt-5 text-center text-sm text-ink-400">
                {issuing
                  ? 'Passmint is issuing your pass…'
                  : card
                    ? 'The pass in your wallet, as it looks right now'
                    : 'Your card will appear here'}
              </p>
            </PhoneFrame>
          )}
        </div>

        <div className="flex flex-col gap-8">
          {/* On a phone that already holds the card, the pass is the headline. */}
          <div className={onPhone && card ? 'sr-only' : undefined}>
            <h1 className="type-wide text-[2.6rem] leading-[0.95] text-balance sm:text-6xl">
              A punch card that updates itself.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
              {card
                ? 'Each coffee punches the card from here, and the pass in your wallet catches up on its own. Nine punches and the tenth cup is free.'
                : "Get a Punchline card in Apple or Google Wallet. Each coffee punches it from here, straight to the phone in your pocket. Nine punches and the tenth cup's on us."}
            </p>
          </div>

          {card === null ? (
            onPhone ? (
              <Link
                to={scanPath}
                reloadDocument
                className="w-fit rounded-full bg-cobalt-500 px-7 py-4 text-lg font-semibold text-white hover:bg-cobalt-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-butter-400"
              >
                Get your punch card
              </Link>
            ) : (
              <div className="flex items-center gap-6">
                <div
                  className="size-40 shrink-0 rounded-2xl bg-white p-3 shadow-sm [&_svg]:size-full"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr
                  dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }}
                />
                <div className="flex flex-col gap-3">
                  <p className="text-lg font-semibold">Scan with your phone's camera</p>
                  <p className="flex items-center gap-2 text-sm text-ink-600">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-cobalt-500 motion-safe:animate-pulse"
                    />
                    This page picks up your card once you've scanned
                  </p>
                  <Link
                    to={scanPath}
                    reloadDocument
                    className="w-fit text-sm text-ink-600 underline decoration-ink-400/50 underline-offset-4 hover:text-ink-900"
                  >
                    No phone handy? Get the card in this browser
                  </Link>
                </div>
              </div>
            )
          ) : issuing ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <p role="status" className="flex items-center gap-2 font-medium text-cobalt-600">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-cobalt-500 motion-safe:animate-pulse"
                />
                Passmint is issuing your pass…
              </p>
              <div className="flex flex-wrap gap-3" aria-hidden="true">
                <span className="skeleton h-[60px] w-44 rounded-full" />
                <span className="skeleton h-[60px] w-48 rounded-full" />
              </div>
              <p className="max-w-md text-sm text-ink-600">
                It usually takes a second or two. You can add it to your wallet as soon as it
                appears.
              </p>
            </div>
          ) : issueFailed ? (
            <div className="flex flex-col gap-4">
              <div role="alert" className="rounded-2xl bg-cherry-50 px-5 py-4 text-cherry-600">
                <p className="font-semibold">Passmint couldn't issue your pass</p>
                <p className="mt-1 text-sm">
                  {card.issueError ?? 'Issuing took too long. Try again.'}
                </p>
              </div>
              <Form method="post">
                <input type="hidden" name="intent" value="retry" />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-cobalt-500 px-7 py-4 text-lg font-semibold text-white hover:bg-cobalt-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-butter-400 disabled:opacity-60"
                >
                  Try again
                </button>
              </Form>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {walletTracking && <WalletStatus card={card} />}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-cherry-50 px-4 py-3 text-sm text-cherry-600"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Form method="post">
                  <input type="hidden" name="intent" value={earned ? 'redeem' : 'stamp'} />
                  <button
                    type="submit"
                    disabled={pending}
                    className={`rounded-full px-7 py-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60 ${
                      earned
                        ? 'bg-butter-400 text-ink-900 hover:bg-butter-600 focus-visible:outline-cobalt-500'
                        : 'bg-cobalt-500 text-white hover:bg-cobalt-600 focus-visible:outline-butter-400'
                    }`}
                  >
                    {earned ? 'Redeem the free coffee' : 'Buy a coffee'}
                  </button>
                </Form>
                {onPhone && !(walletTracking && card.addedAt) && (
                  <WalletButtons card={card} device={device} />
                )}
                {!earned && count < REWARD_AT && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="skip" />
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full border border-ink-900/15 bg-white px-5 py-3 font-medium text-ink-900 hover:border-ink-900/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500 disabled:opacity-60"
                    >
                      Skip to {REWARD_AT} punches
                    </button>
                  </Form>
                )}
              </div>
              {pending && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm font-medium text-cobalt-600"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-cobalt-500 motion-safe:animate-pulse"
                  />
                  Sending the update to your phone…
                </p>
              )}
              <p className="max-w-md text-sm text-ink-600">
                {earned
                  ? 'At a real café the barista redeems it at the till. Either way the card starts a new round.'
                  : onPhone
                    ? 'Each tap adds a punch and pushes it to the pass in your wallet. Add the card first, then try it with Wallet open.'
                    : 'Each tap adds a punch and pushes it to the pass on your phone, so keep the phone where you can see it.'}
                {!earned &&
                  count < REWARD_AT &&
                  ' The skip button is a demo shortcut to the free-coffee card.'}
              </p>

              {joinQrSvg && !(walletTracking && card.addedAt) && (
                <div className="flex items-center gap-4 rounded-2xl bg-white p-3 pr-5 shadow-[0_1px_2px_rgb(14_26_77/0.06)]">
                  <div
                    className="size-24 shrink-0 [&_svg]:size-full"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr
                    dangerouslySetInnerHTML={{ __html: joinQrSvg }}
                  />
                  <div>
                    <p className="font-semibold">Add this card to your phone</p>
                    <p className="mt-1 text-sm text-ink-600">
                      Scan with your phone's camera to open card {card.shortId} there, then add it
                      to Apple or Google Wallet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold">What just happened</h2>
              {card && (
                <Link
                  to="/scan"
                  reloadDocument
                  className="text-sm text-ink-400 underline decoration-ink-400/40 underline-offset-4 hover:text-ink-900"
                >
                  Start a new card
                </Link>
              )}
            </div>
            <ActivityFeed items={feed} freshIds={freshIds} />
          </section>
        </div>
      </div>

      <BuiltWithPassmint />
    </Page>
  )
}

// What this demo is for, stated plainly: Punchline is made up; the wallet
// pass, its updates and the delivery receipts are Passmint.
function BuiltWithPassmint() {
  return (
    <section className="mb-12 grid gap-8 border-t border-ink-900/10 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <div>
        <h2 className="type-wide text-3xl leading-tight">Built with Passmint</h2>
        <p className="mt-3 max-w-md text-ink-600">
          Punchline is a made-up café. Everything that happens to the pass is real, and runs on
          Passmint: one API for Apple and Google Wallet passes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {/* TODO: confirm the final Passmint marketing URL. */}
          <a
            href="https://passmint.com"
            className="rounded-full bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-ink-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
          >
            Try Passmint
          </a>
          <a
            href="https://github.com/getpassmint/punchline"
            className="flex items-center gap-2 rounded-full border border-ink-900/15 bg-white px-5 py-2.5 font-semibold text-ink-900 hover:border-ink-900/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
          >
            <GitHubMark />
            View source
          </a>
        </div>
      </div>
      <dl className="grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Issue</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Scanning the code makes one <code className="text-ink-900">passes.create()</code> call.
            Passmint signs the pass and hosts the add-to-wallet page.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Update</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Each punch is one <code className="text-ink-900">passes.update()</code>. Passmint
            re-signs it, swaps the strip art and pushes it to the phone.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Hear back</dt>
          <dd className="mt-1 text-sm text-ink-600">
            Webhooks report when the pass lands in a wallet and when the phone picks up each update.
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}
