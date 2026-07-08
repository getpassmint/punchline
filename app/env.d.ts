// Secrets set via `wrangler secret put` (production) or .dev.vars (local).
// Declared here because `wrangler types` only discovers them from .dev.vars,
// which is gitignored — without this, CI regenerates Env without them and
// typecheck fails. Keep in sync with .dev.vars.example.
interface Env {
  PASSMINT_API_KEY: string
  PASSMINT_WEBHOOK_SECRET?: string
}
