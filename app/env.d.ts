// Secrets (`wrangler secret put`, or .dev.vars locally). `wrangler types`
// only finds them in .dev.vars, which CI doesn't have, so they're declared
// here. Keep in sync with .dev.vars.example.
interface Env {
  PASSMINT_API_KEY: string
  PASSMINT_WEBHOOK_SECRET?: string
}
