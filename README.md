# tenthcup ☕

**A fictional café whose stamp card lives in Apple Wallet and Google Wallet.** Buy nine coffees, the tenth's on us. Built on [Passmint](https://passmint.com) <!-- TODO: confirm the final Passmint marketing URL --> as an open-source reference implementation.

<!-- TODO: hero GIF — the pass updating live on an iPhone the moment the counter stamps it. -->

<!-- TODO: confirm the public repo URL before launch. -->
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/getpassmint/tenthcup.coffee)

Deploy your own in a couple of clicks — the button provisions the Worker and D1 database. You still add your `PASSMINT_API_KEY` secret and `PASSMINT_TEMPLATE_ID` afterwards (see [Deploy](#deploy)).

All the Passmint logic is one ~70-line file: [`app/lib/passmint.server.ts`](app/lib/passmint.server.ts). The routes stay thin so it's the star.

## What this demonstrates

Issuing a wallet pass with a single API call — no signup, no certificates, no `.pkpass` signing in this repo. Pushing live updates to a pass that's already on someone's phone by changing field values, with Apple re-signing, APNs delivery, and the Google Wallet object patch all handled by the platform. State transitions on a real product loop: stamp → reward → redeem → reset, each one visible on the phone without opening anything.

## Run it in 5 minutes

You need Node 22+, [pnpm](https://pnpm.io), and a Passmint account with an API key and a **loyalty** template. <!-- TODO: link the Passmint docs page for creating an account + template. --> The easiest template is the **Coffee Loyalty** starter — this app's field keys match it out of the box (see [the field contract](#the-field-contract) below).

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then fill in your API key + template id
pnpm db:migrate                  # applies migrations/ to a local D1 copy
pnpm dev                         # → http://localhost:5173
```

Open the landing page, scan the QR with your phone (or tap the link on the phone itself), add the pass to your wallet, then press **Simulate a visit** — and watch the pass on your phone update by itself. That button is the whole point: you get the push-update moment with no second device and no barista roleplay.

A `pmk_test_` key issues fully functional passes — real signing, real APNs pushes, real webhooks — watermarked **[TEST]** on the pass face, using Passmint's shared dev certificate and demo Google issuer. A `pmk_live_` key removes the watermark but requires your own Apple certificate set and Google Wallet issuer connected in the Passmint dashboard.

### Deploy

```sh
wrangler d1 create tenthcup-coffee   # then paste the id into wrangler.jsonc
pnpm db:migrate:remote
wrangler secret put PASSMINT_API_KEY
pnpm run deploy
```

Set `PASSMINT_TEMPLATE_ID` in `wrangler.jsonc`, and attach your custom domain in the Cloudflare dashboard (the config deliberately doesn't manage it — see the `TODO:` markers in `wrangler.jsonc`).

## How it works

Two pages, one D1 table, one file that talks to Passmint.

```
/          landing — QR code → your card + "Simulate a visit"
/counter   barista view — Stamp / Redeem buttons per card
```

The division of labor is the first thing [`passmint.server.ts`](app/lib/passmint.server.ts) explains, because it's what the demo teaches: the pass **template** — design, colors, logo, field layout, certificates — lives on the Passmint platform. This app owns only the **dynamic state** (stamp count, reward or not) and maps it onto the template's field keys.

**Issuing** is one call. Scanning the QR hits `/scan`, which runs:

```ts
return client(env).passes.create({
  templateId: env.PASSMINT_TEMPLATE_ID,
  fieldValues: loyaltyFieldValues(0, 'active'),
  metadata: { app: 'tenthcup' },
})
```

Back comes a pass with a hosted `url` — a platform-detecting add-to-wallet page (Apple `.pkpass` on iOS, Google save link on Android, a QR on desktop). That hosted page is also why this repo has zero wallet callback routes: Apple's device registration and Google's callbacks all point at Passmint, not at us.

**Stamping** is the money moment. The counter (or the simulate button) increments the count in D1 and pushes the new state:

```ts
return client(env).passes.update(passId, {
  fieldValues: loyaltyFieldValues(stampCount, state),
})
```

That single `update` makes Passmint re-sign the `.pkpass`, send the APNs push that tells iOS to re-fetch and redraw the pass, and patch the Google Wallet object. The stamp count changes on the phone's lock screen without anyone opening anything.

**The ninth stamp** flips the card to its reward state — `9 / 10`, the tenth slot open, and "Free coffee — show this at the counter" on the pass. The tenth cup is the free one: it never gets stamped, it gets redeemed. One honest limitation, stated because the demo shouldn't overclaim: a pass update changes *field values*, not colors — visual design is template-scoped, so reward state is expressed through field emphasis rather than a per-pass color flip.

**Redeeming** resets the card to zero with the same `update` call, so the loop replays forever.

### The field contract

`loyaltyFieldValues()` sends three keys; template fields with matching keys update, unknown keys are ignored, and unsent fields keep their template defaults:

| key | on the pass | example |
| --- | --- | --- |
| `count` | primary field, front and center | `4 / 10` |
| `stamps` | the punch row (add a field with this key to show it) | `●●●●○○○○○○` |
| `nextReward` | secondary field — the state line | `5 more for a free coffee` |

### Lifecycle events

Every transition logs one JSON line (`app/lib/events.server.ts`) — visible with `wrangler tail`. The app emits `pass.issued`, `pass.stamped`, `pass.reward_earned`, and `pass.redeemed`; on the wire, the stamp/reward/redeem transitions all surface as canonical `pass.update_pushed` events (then `pass.update_delivered` when the phone re-fetches). Register the webhook receiver and the platform's canonical events — `pass.added_to_wallet`, `pass.removed`, and the rest of `PASSMINT_EVENT_TYPES` — join the same stream; setup is a comment atop [`app/routes/api.webhooks.passmint.ts`](app/routes/api.webhooks.passmint.ts).

## The pattern, generalized

A stamp card is just **state in the wallet plus a push when it changes**. Same shape, different nouns:

- a membership card where the tier field updates the day you level up
- a class-pack tracker — `7 of 10 classes` — that gyms print on paper today
- a gift card whose balance updates the moment it's spent
- a coffee-subscription card that flips to "paused" with the subscription
- a queue ticket that counts down "3 ahead of you" while the phone stays in a pocket
- a punch card for anything countable: car washes, haircuts, farmers-market visits

## Demo-grade, deliberately

Tenthcup is a fictional café. No accounts, no payments, no admin — one table, two pages, and `TODO:` markers where a real deployment would make real choices. The heavy machinery it *doesn't* contain — certificate management, the Apple Wallet web service, APNs and Google Wallet delivery, webhook signing and retries — is what [Passmint](https://passmint.com) <!-- TODO: confirm URL --> provides.

MIT licensed. Built with React Router 7 (framework mode) on Cloudflare Workers + D1, linted with Biome. Extra dependencies earn their place in one sentence each: [`@passmint/node`](https://github.com/getpassmint/passmint-node) is the SDK this demo exists to showcase; `uqr` renders the landing-page QR as an SVG in any runtime; `isbot` keeps the standard React Router streaming entry working for crawlers.
