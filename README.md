# Punchline

A made-up café whose punch card lives in Apple Wallet and Google Wallet, and updates itself. It's an open-source demo of [Passmint](https://passmint.com), the API for wallet passes.

**Try it:** [punchline.passmint.com](https://punchline.passmint.com)

![Punchline](public/og-image.png)

## How it works

Scan the QR code and Punchline issues you a pass with one Passmint call. Each coffee punches the card: the app updates the pass, and Passmint re-signs it and pushes it to your phone, where it redraws on its own. Nine punches and the tenth cup is free.

- **Issuing:** `passes.create()` returns a hosted add-to-wallet page, so there's no certificate handling or pass signing in this repo.
- **Updating:** `passes.update()` sends the new punch count and picks the matching strip image, one per punch count, so the art on the pass fills in too.
- **Hearing back:** optional webhooks report when the pass lands in a wallet and when the phone picks up each update.

Every Passmint call is in [`app/lib/passmint.server.ts`](app/lib/passmint.server.ts). The card state lives in Cloudflare D1, and the app runs on Cloudflare Workers with React Router.

## Run it locally

You need Node 22+, [pnpm](https://pnpm.io), and a Passmint account with an API key and a loyalty template (the **Coffee Loyalty** starter works as is).

```sh
pnpm install
cp .dev.vars.example .dev.vars   # add your API key and template id
pnpm db:migrate
pnpm dev --host
```

Open the local network address it prints (not `localhost`, so your phone can reach it), then scan the QR code with your phone.

A `pmk_test_` key issues working passes marked **[TEST]**. A `pmk_live_` key needs your own Apple certificate and Google issuer connected in Passmint.

To give the pass the punched-hole strip art and a lock-screen notification on each punch, set up the template once:

```sh
pnpm setup:pass --preview ./pass-art   # optional: look at the images first
pnpm setup:pass
```

## Deploy

```sh
wrangler d1 create punchline   # put the id in wrangler.jsonc
wrangler secret put PASSMINT_API_KEY
pnpm db:migrate:remote
pnpm run deploy
```

Update `PASSMINT_TEMPLATE_ID`, `PUBLIC_URL` and the custom domain route in `wrangler.jsonc` first. Run `pnpm db:migrate:remote` before deploying any change that adds a migration: Cloudflare's Git integration deploys code but doesn't migrate the database.

## License

[MIT](LICENSE)
