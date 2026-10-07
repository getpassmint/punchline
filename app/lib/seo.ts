// Page metadata, including the Open Graph / Twitter card that link previews
// use. URLs are built from the request's own origin, so the production site,
// its workers.dev address and any fork all point previews at themselves.
const SITE_NAME = 'Punchline'

const OG_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Punchline: a punch card that updates itself. A live Passmint demo for Apple and Google Wallet.',
}

export function seo({
  title,
  description,
  path,
  origin,
}: {
  title: string
  description: string
  path: string
  origin: string | undefined
}) {
  const base = origin ?? 'https://punchline.passmint.com'
  const url = new URL(path, base).toString()
  const image = new URL(OG_IMAGE.path, base).toString()

  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: String(OG_IMAGE.width) },
    { property: 'og:image:height', content: String(OG_IMAGE.height) },
    { property: 'og:image:alt', content: OG_IMAGE.alt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: OG_IMAGE.alt },
  ]
}
