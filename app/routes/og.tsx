import { LogoMark, PassPreview } from '../components/pass-preview'
import { PassmintMark } from '../components/passmint-mark'
import type { Route } from './+types/og'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Share image · Punchline' }, { name: 'robots', content: 'noindex' }]
}

// The Open Graph / Twitter card image, drawn with the site's own components
// and fonts. public/og-image.png is a 1200×630 screenshot of this page;
// re-take it after changing the design (any headless browser will do).
export default function OgImage() {
  return (
    <div className="flex h-[630px] w-[1200px] overflow-hidden bg-milk">
      <div className="flex w-[680px] flex-col justify-between py-[68px] pr-4 pl-20">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <span className="type-wide text-[44px] leading-none">punchline</span>
        </div>
        <div>
          <h1 className="type-wide text-[62px] leading-[0.98]">
            A punch card that updates itself.
          </h1>
          <p className="mt-5 max-w-[520px] text-[25px] leading-snug text-ink-600">
            Every coffee punches the pass in your Apple or Google Wallet.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[22px] text-ink-600">
          <span className="flex items-center gap-2 rounded-full border border-ink-900/15 bg-white px-4 py-2 text-ink-900">
            <span className="[&_svg]:h-6">
              <PassmintMark />
            </span>
            <span className="text-ink-600">demo</span>
          </span>
          <span>punchline.passmint.com</span>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center pr-12">
        <div className="w-[400px] rotate-[4deg]">
          <PassPreview platform="apple" count={6} state="active" />
        </div>
      </div>
    </div>
  )
}
