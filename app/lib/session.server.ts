import { createCookie } from 'react-router'

// A visitor's session id — a pointer, not auth; there are no accounts here.
// The laptop mints it, the QR carries it to the phone, and from then on both
// browsers resolve the same card. Anyone holding the id can stamp that card,
// which is fine for a demo café and exactly what makes the pairing work.
const sessionCookie = createCookie('punchline_session', {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 365,
})

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value)
}

export async function readSession(request: Request): Promise<string | null> {
  const value = await sessionCookie.parse(request.headers.get('Cookie'))

  return isSessionId(value) ? value : null
}

// The existing session, or a fresh one plus the Set-Cookie header that
// persists it.
export async function ensureSession(
  request: Request,
): Promise<{ sessionId: string; headers: HeadersInit }> {
  const existing = await readSession(request)

  if (existing) {
    return { sessionId: existing, headers: {} }
  }

  const sessionId = crypto.randomUUID()

  return { sessionId, headers: { 'Set-Cookie': await sessionCookie.serialize(sessionId) } }
}

export function serializeSession(sessionId: string): Promise<string> {
  return sessionCookie.serialize(sessionId)
}
