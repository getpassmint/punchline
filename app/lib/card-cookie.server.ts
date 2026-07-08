import { createCookie } from 'react-router'

// Remembers which card this browser issued, so the landing page can offer
// "simulate a visit". A pointer, not auth — there are no accounts here.
export const cardCookie = createCookie('tenthcup_card', {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
})
