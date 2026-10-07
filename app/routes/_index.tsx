import { useEffect, useRef, useState } from 'react'
import { data, Form, Link, useFetcher, useNavigation } from 'react-router'
import { renderSVG } from 'uqr'
import { ActivityFeed } from '../components/activity-feed'
import { BuiltWithPassmint } from '../components/built-with-passmint'
import { Page } from '../components/page'
import { PassPreview, PhoneFrame, type WalletPlatform } from '../components/pass-preview'
import { Step } from '../components/step'
import { WalletButtons } from '../components/wallet-buttons'
import { WalletStatus } from '../components/wallet-status'
import { cloudflareContext } from '../context'
import { useAddedToWallet } from '../hooks/use-added-to-wallet'
import { useLiveData } from '../hooks/use-live-data'
import { BRAND } from '../lib/brand'
import { detectDevice } from '../lib/device'
import { walletName } from '../lib/format'
import {
  completeIssue,
  getSessionCard,
  listActivity,
  restartIssue,
  transitionCard,
} from '../lib/loyalty.server'
import { applyIntent, type FeedItem, pendingActivity } from '../lib/optimistic'
import { describePassmintError, setupProblem } from '../lib/passmint.server'
import { REWARD_AT } from '../lib/rules'
import { seo } from '../lib/seo'
import { ensureSession, readSession } from '../lib/session.server'
import { button } from '../lib/ui'
import type { Route } from './+types/_index'

export function meta({ loaderData }: Route.MetaArgs) {
  return seo({
    title: 'Punchline: a punch card that updates itself',
    description:
      'A made-up café whose punch card lives in Apple and Google Wallet and updates itself with every coffee. A live demo of Passmint.',
    path: '/',
    origin: loaderData?.origin,
  })
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext)
  // Minted on the first visit, so the QR can carry it to the phone.
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
      origin: env.PUBLIC_URL || new URL(request.url).origin,
      testMode: env.PASSMINT_API_KEY?.startsWith('pmk_test_') ?? false,
      scanPath,
      // /scan issues a card on the phone; /join opens an existing one there.
      qrSvg: card ? null : qr(scanPath),
      joinQrSvg:
        card?.issueState === 'ready' && device === 'desktop' ? qr(`/join?s=${sessionId}`) : null,
      // Issuing takes a few seconds; past 45s it has died, so offer a retry.
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

  // Sent by the page when the card is still issuing after a few seconds: the
  // background run may have been cut off, so finish it here (no 30s cap).
  if (intent === 'nudge') {
    if (card.issueState === 'issuing') {
      await completeIssue(env, card.id)
    }

    return { ok: true as const }
  }

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
    const transition = intent === 'redeem' || intent === 'skip' ? intent : 'stamp'

    await transitionCard(env, card.id, transition, 'visitor')

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
  const {
    card,
    activity,
    device,
    qrSvg,
    joinQrSvg,
    scanPath,
    walletTracking,
    issueStuck,
    testMode,
  } = loaderData
  // A phone shows its own wallet's replica; a laptop can switch.
  const [platform, setPlatform] = useState<WalletPlatform>(
    device === 'android' ? 'google' : 'apple',
  )
  const issuing = card?.issueState === 'issuing' && !issueStuck
  const issueFailed = card?.issueState === 'failed' || issueStuck
  const ready = card?.issueState === 'ready'

  const [addedHere, markAdded] = useAddedToWallet(card?.id)
  const added = Boolean(walletTracking && card?.addedAt) || addedHere
  const navigation = useNavigation()
  // A transition in flight: show its outcome now (see optimistic.ts).
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

  // Poll fastest while issuing, then while waiting for the phone to scan.
  useLiveData(issuing ? 1000 : card ? 3000 : 2000)

  // Still issuing after 8s? Ask the server to finish it (the action's nudge).
  const nudge = useFetcher()
  const submitNudge = nudge.submit

  useEffect(() => {
    if (!issuing) {
      return
    }

    const timer = window.setTimeout(
      () => submitNudge({ intent: 'nudge' }, { method: 'post', action: '/?index' }),
      8000,
    )

    return () => window.clearTimeout(timer)
  }, [issuing, submitNudge])

  // Animate new punches and feed rows from any source (this tab, the counter,
  // the paired phone) by comparing with the previous render.
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
      platform={platform}
      count={count}
      state={shown?.state ?? 'active'}
      newest={newPunch}
      placeholder={!card}
      issuing={issuing}
      testMode={testMode}
    />
  )

  return (
    <Page>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-16 gap-y-10 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-14">
        <div className="lg:sticky lg:top-6">
          {onPhone ? (
            card && <div className="mx-auto max-w-sm">{pass}</div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <fieldset className="flex rounded-full bg-white p-1 shadow-[0_1px_2px_rgb(14_26_77/0.06)]">
                <legend className="sr-only">Show the pass as</legend>
                {(['apple', 'google'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={platform === p}
                    onClick={() => setPlatform(p)}
                    className={`h-9 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500 ${
                      platform === p ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    {p === 'apple' ? 'Apple Wallet' : 'Google Wallet'}
                  </button>
                ))}
              </fieldset>
              <PhoneFrame platform={platform}>
                {pass}
                <p className="mt-5 text-center text-sm text-ink-400">
                  {issuing
                    ? 'Passmint is issuing your pass…'
                    : card
                      ? 'The pass in your wallet, as it looks right now'
                      : 'Your card will appear here'}
                </p>
              </PhoneFrame>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-8">
          {/* On a phone with a card, the pass is the headline. */}
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

          <ol className="flex flex-col gap-3" aria-label="Try the demo">
            <Step
              n={1}
              title="Get your card"
              state={card && !issuing && !issueFailed ? 'done' : 'current'}
              summary={
                card?.shortId && (
                  <>
                    Card {card.shortId} ·{' '}
                    <Link
                      to="/scan"
                      reloadDocument
                      className="underline decoration-ink-400/40 underline-offset-4 hover:text-ink-900"
                    >
                      Start a new card
                    </Link>
                  </>
                )
              }
            >
              {card === null ? (
                onPhone ? (
                  <Link to={scanPath} reloadDocument className={button()}>
                    Get your punch card
                  </Link>
                ) : (
                  <div className="flex items-center gap-5">
                    <div
                      className="size-32 shrink-0 rounded-xl bg-milk p-2 [&_svg]:size-full"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr
                      dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }}
                    />
                    <div className="flex flex-col gap-2.5">
                      <p className="font-medium">Scan with your phone's camera</p>
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
              ) : issueFailed ? (
                <div className="flex flex-col gap-3">
                  <div role="alert" className="rounded-xl bg-cherry-50 px-4 py-3 text-cherry-600">
                    <p className="font-semibold">Passmint couldn't issue your pass</p>
                    <p className="mt-1 text-sm">
                      {card.issueError ?? 'Issuing took too long. Try again.'}
                    </p>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="retry" />
                    <button type="submit" disabled={pending} className={button()}>
                      Try again
                    </button>
                  </Form>
                </div>
              ) : (
                <p role="status" className="flex items-center gap-2 text-cobalt-600">
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-cobalt-500 motion-safe:animate-pulse"
                  />
                  Passmint is issuing your pass. It usually takes a second or two.
                </p>
              )}
            </Step>

            <Step
              n={2}
              title="Add it to your wallet"
              state={!ready ? 'upcoming' : added ? 'done' : 'current'}
              summary={
                walletTracking && card?.addedAt ? `In ${walletName(card.walletPlatform)}` : 'Added'
              }
            >
              {card &&
                ready &&
                (onPhone ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-3">
                      <WalletButtons card={card} device={device} onAdd={markAdded} />
                    </div>
                    <p className="text-sm text-ink-600">
                      Add the pass, then come back here to buy a coffee.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    {joinQrSvg && (
                      <div
                        className="size-28 shrink-0 rounded-xl bg-milk p-2 [&_svg]:size-full"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG generated server-side by uqr
                        dangerouslySetInnerHTML={{ __html: joinQrSvg }}
                      />
                    )}
                    <div className="flex flex-col gap-2.5">
                      <p className="text-sm text-ink-600">
                        Scan with your phone's camera to open card {card.shortId} there, then add it
                        to Apple or Google Wallet.
                      </p>
                      <button
                        type="button"
                        onClick={markAdded}
                        className="w-fit text-sm font-medium text-cobalt-600 underline decoration-cobalt-500/40 underline-offset-4 hover:text-cobalt-500"
                      >
                        I've added it
                      </button>
                    </div>
                  </div>
                ))}
            </Step>

            <Step
              n={3}
              title={earned ? 'Redeem your free coffee' : 'Buy a coffee'}
              state={!ready ? 'upcoming' : added ? 'current' : 'available'}
            >
              {card && ready && (
                <div className="flex flex-col gap-3">
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
                        className={button(earned ? 'reward' : 'primary')}
                      >
                        {earned ? 'Redeem the free coffee' : 'Buy a coffee'}
                      </button>
                    </Form>
                    {!earned && count < REWARD_AT && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="skip" />
                        <button type="submit" disabled={pending} className={button('secondary')}>
                          Skip to {REWARD_AT} punches
                        </button>
                      </Form>
                    )}
                  </div>
                  {pending ? (
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
                  ) : (
                    <p className="text-sm text-ink-600">
                      {earned
                        ? 'At a real café the barista redeems it at the till. Either way the card starts a new round.'
                        : onPhone
                          ? 'Each tap punches the card and pushes it to the pass in your wallet. Open Wallet to see it.'
                          : 'Each tap punches the card and pushes it to the pass on your phone, so keep the phone where you can see it.'}
                      {!earned &&
                        count < REWARD_AT &&
                        ' Skip jumps straight to the free-coffee card.'}
                    </p>
                  )}
                  {walletTracking && <WalletStatus card={card} />}
                </div>
              )}
            </Step>
          </ol>

          <section>
            <h2 className="mb-2 text-lg font-semibold">What just happened</h2>
            <ActivityFeed items={feed} freshIds={freshIds} />
          </section>
        </div>
      </div>

      <BuiltWithPassmint />
    </Page>
  )
}
