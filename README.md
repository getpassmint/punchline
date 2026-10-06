# Punchline

**A made-up café whose punch card lives in Apple Wallet and Google Wallet, and updates itself.** Buy nine coffees and the tenth is free. It's an open-source reference implementation built on [Passmint](https://passmint.com). <!-- TODO: confirm the final Passmint marketing URL -->

<!-- TODO: hero GIF — the pass punching itself on an iPhone while the laptop presses "Buy a coffee". -->

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/getpassmint/punchline)

The button provisions the Worker and D1 database. You still add your `PASSMINT_API_KEY` secret and `PASSMINT_TEMPLATE_ID` afterwards (see [Deploy](#deploy)).

Every Passmint call lives in one short file: [`app/lib/passmint.server.ts`](app/lib/passmint.server.ts).

## What this demonstrates

- **Issuing** a wallet pass with one API call. There's no signup, no certificates and no `.pkpass` signing in this repo.
- **Pushing updates** to a pass that's already on someone's phone. Apple re-signing, APNs delivery and the Google Wallet patch are all handled by the platform.
- **Changing the pass art per pass.** Each punch swaps the strip image for one showing the new count, using template image variants.
- **Hearing back.** Webhooks report when the pass lands in a wallet and when the phone picks up each update.

## Run it in 5 minutes

You need Node 22+, [pnpm](https://pnpm.io), and a Passmint account with an API key and a **loyalty** template. <!-- TODO: link the Passmint docs page for creating an account + template. --> The **Coffee Loyalty** starter works out of the box (see [the field contract](#the-field-contract)).

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then fill in your API key + template id
pnpm db:migrate                  # applies migrations/ to a local D1 copy
pnpm dev --host                  # → http://localhost:5173, plus a LAN address
```

1. Open the LAN address on your laptop. Not `localhost`: the QR encodes the page's own URL, and your phone has to be able to reach it.
2. Scan the QR with your phone. The pass is issued, the phone offers **Add to Apple/Google Wallet**, and the laptop page picks up the same card.
3. Add the pass, put the phone down, and press **Buy a coffee** on the laptop.

The punch lands on the pass in your wallet a moment later, with nothing open on the phone. Beside it, the laptop shows a live replica of the pass and a feed of each API call as it happens.

A `pmk_test_` key issues fully working passes (real signing, real APNs pushes, real webhooks), watermarked **[TEST]** and signed with Passmint's shared dev certificate and demo Google issuer. A `pmk_live_` key removes the watermark, but needs your own Apple certificate and Google Wallet issuer connected in the Passmint dashboard.

### Make the pass look like the page

With the starter template, the pass shows the punch count as text. To get the punched-hole strip art, matching colours and a lock-screen notification on every punch, run the setup script once. It changes the template, and templates are shared by test and live mode, so live passes get the new look too.

```sh
pnpm setup:pass --preview ./pass-art   # optional: write the PNGs locally to look at
pnpm setup:pass                        # reads PASSMINT_API_KEY / PASSMINT_TEMPLATE_ID from .dev.vars
```

`PASSMINT_STRIP_VARIANTS` is `"on"` in `wrangler.jsonc`. Until you've run the script, Passmint rejects the variant names, so the app retries each update without them (and logs `pass.strip_variant_missing`). Punches still land, just without the strip art. Set it to `"off"` to skip the retry.

### Deploy

```sh
wrangler d1 create passmint-punchline-demo   # then paste the id into wrangler.jsonc
pnpm db:migrate:remote
wrangler secret put PASSMINT_API_KEY
pnpm run deploy
```

Set `PASSMINT_TEMPLATE_ID` in `wrangler.jsonc`, and attach your custom domain in the Cloudflare dashboard. The config also declares:

- a per-IP rate limit on `/scan` (`SCAN_LIMITER`; pick any `namespace_id` that's unique in your account)
- a daily cron that voids idle cards (see [Keeping a public demo tidy](#keeping-a-public-demo-tidy))

## How it works

Two pages, two D1 tables, and one file that talks to Passmint.

```
/                       home — QR code → your card, "Buy a coffee" / "Redeem"
/scan                   issues a pass, then redirects home (the QR's target)
/counter                barista view — Punch / Redeem buttons per card
/api/webhooks/passmint  Passmint lifecycle events → wallet status + activity
```

The first thing [`passmint.server.ts`](app/lib/passmint.server.ts) explains is the split, because it's what the demo teaches:

- The pass **template** lives on the Passmint platform: design, colours, strip art, field layout and certificates.
- This app owns only the **dynamic state** (the punch count, and whether a reward is due). It maps that state onto the template's field keys and image variants.

**Pairing.** The home page gives each visitor a session id (a cookie) and bakes it into the QR as `/scan?s=…`. The phone that scans it joins the session, so the laptop and the phone resolve to the same card. Both pages, and the counter, re-check their data every few seconds while visible ([`use-live-data.ts`](app/hooks/use-live-data.ts)). A punch from any of them shows up on the others. That polling reads D1, never Passmint. A real till would push over a socket instead.

**Issuing** is one call. `/scan` turns bots away and rate-limits each IP, since every hit mints a real pass. Then it runs:

```ts
return client(env).passes.create({
  templateId: env.PASSMINT_TEMPLATE_ID,
  fieldValues: loyaltyFieldValues(0, 'active'),
  imageVariant: stripVariant(env, 0),
  metadata: { app: 'punchline' },
})
```

Back comes a pass with a hosted `url`: an add-to-wallet page that detects the platform (Apple `.pkpass` on iOS, a Google save link on Android, a QR on desktop). That hosted page is also why this repo has no wallet callback routes. Apple's device registration and Google's callbacks all point at Passmint.

**Punching** is the money moment. The counter (or **Buy a coffee**) increments the count in D1 and pushes the new state:

```ts
return client(env).passes.update(passId, {
  fieldValues: loyaltyFieldValues(stampCount, state),
  imageVariant: stripVariant(env, stampCount),
})
```

That one `update` makes Passmint:

- swap in the strip image for the new count
- re-sign the `.pkpass`
- send the APNs push that tells iOS to fetch and redraw the pass
- patch the Google Wallet object, where the strip shows as the hero image

The count changes on the phone without anyone opening anything. With a `changeMessage` on the field, it also buzzes the lock screen with "Punched! 5 / 10".

**The ninth punch** flips the card to its reward state. The tenth slot, a cup, fills in, and the pass says "Free coffee — show this at the counter". The tenth cup is the free one: it never gets punched, it gets redeemed.

**Redeeming** resets the card to zero with the same `update` call, so the loop replays forever.

**Failures stay consistent.** Each transition is one guarded `UPDATE … RETURNING` in D1, so a double-tap or the counter racing the visitor can't over-punch. Then comes the push. If Passmint refuses it, the row is rolled back and the error is shown, so D1 never claims a punch the phone didn't get.

### The strip art

[`pass-strip.tsx`](app/components/pass-strip.tsx) draws the ten punch slots as an SVG React component, and it's used twice:

- **On the web page**, it's the strip in the pass replica.
- **For the pass itself**, [`scripts/setup-pass.tsx`](scripts/setup-pass.tsx) renders it to a 3× PNG (375×98pt, the box Passmint fits strips into) for each count and uploads those as the template's image variants `0`–`9`, with `9` as the reward card.

From then on, `imageVariant: String(count)` on each update chooses the strip. Because one component draws both, the page and the wallet can't drift apart.

### The field contract

`loyaltyFieldValues()` sends three keys. Template fields with matching keys update, unknown keys are ignored, and fields it doesn't send keep their template defaults.

| key | on the pass | example |
| --- | --- | --- |
| `count` | header field, top right; carries the change message | `4 / 10` |
| `nextReward` | secondary field, the state line | `5 more for a free coffee` |
| `stamps` | optional: a text punch row for templates without strip art | `●●●●○○○○○○` |

On Apple Wallet, an update only produces a lock-screen notification if the field has a `changeMessage` in the template (`setup:pass` sets `Punched! %@` on `count`). Without one, the pass still updates, just silently.

### Lifecycle events

Every transition is recorded in two places:

- **The activity feed**, from D1's `card_activity` table, beside the replica.
- **One JSON log line** (`app/lib/events.server.ts`), visible with `wrangler tail`.

The app's own events are `pass.issued`, `pass.stamped`, `pass.reward_earned`, `pass.redeemed` and `pass.retired`. On the wire, the punch/reward/redeem transitions surface as Passmint's canonical `pass.update_pushed` events, followed by `pass.update_delivered` when the phone fetches the update.

Register the webhook receiver and Passmint's events join the feed, along with a **delivery receipt** under the card and on each counter row:

1. *Not in a wallet yet*
2. *In Apple Wallet*, on `pass.added_to_wallet`
3. *Update sent — waiting for the phone…*, right after a punch
4. *Up to date · delivered 2s ago*, on `pass.update_delivered`

The feed also shows how long each phone took to pick up its push. Without a webhook secret, the receipt is hidden. To register:

```ts
const hook = await passmint.webhooks.create({
  url: 'https://<your-domain>/api/webhooks/passmint',
  events: ['pass.added_to_wallet', 'pass.update_delivered', 'pass.removed'],
})
// hook.secret is returned once → wrangler secret put PASSMINT_WEBHOOK_SECRET
```

Webhooks need a public URL. Locally they only arrive if you tunnel, e.g. `cloudflared tunnel --url http://localhost:5173`.

### Keeping a public demo tidy

Every card is a live pass, and Passmint plans count active passes.

- Starting a new card voids the session's previous pass.
- A daily cron (`workers/app.ts`) voids any card that hasn't been touched for 7 days and drops its rows.

A voided pass stays in the holder's wallet, marked as no longer valid.

## The pattern, generalized

A punch card is just **state in the wallet plus a push when it changes**. Image variants let the art follow the state. The same shape works for other things:

- a membership card whose tier badge changes the day you level up
- a class-pack tracker (`7 of 10 classes`) that gyms print on paper today
- a gift card whose balance updates the moment it's spent
- a queue ticket that counts down "3 ahead of you" while the phone stays in a pocket
- a punch card for anything countable: car washes, haircuts, farmers-market visits

## Demo-grade, deliberately

Punchline is a fictional café. There are no accounts, no payments and no admin. Anyone with a card's session id, or the counter URL, can punch it. `TODO:` markers sit where a real deployment would make real choices.

The heavy machinery it *doesn't* contain is what [Passmint](https://passmint.com) <!-- TODO: confirm URL --> provides: certificate management, the Apple Wallet web service, APNs and Google Wallet delivery, and webhook signing and retries.

MIT licensed. Built with React Router 7 (framework mode) on Cloudflare Workers + D1, and linted with Biome. Each extra dependency has one job:

- [`@passmint/node`](https://github.com/getpassmint/passmint-node) is the SDK this demo exists to show off.
- `uqr` renders the home-page QR as an SVG in any runtime.
- `isbot` keeps crawlers away from `/scan` and keeps the standard React Router streaming entry working for them.
- `tsx` and `@resvg/resvg-js` run the one-off `setup:pass` script and turn its SVGs into PNGs.
