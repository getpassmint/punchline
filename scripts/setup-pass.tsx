// One-off setup for the pass template: brand colours and field labels, a
// lock-screen change message on the punch count, and the strip art — one
// image variant per punch count, rendered from the same <PassStrip> the web
// page draws. After this, every passes.update() picks the matching strip via
// `imageVariant`, so the punches on the pass change like the ones on the page.
//
//   pnpm setup:pass                         # reads PASSMINT_* from .dev.vars
//   pnpm setup:pass --preview ./pass-art   # just write the PNGs, no API calls
//
// Templates are shared by test and live mode, so this changes the template
// for both. Safe to re-run; it overwrites in place.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Passmint, type TemplateDesign } from '@passmint/node'
import { Resvg } from '@resvg/resvg-js'
import { renderToStaticMarkup } from 'react-dom/server'
import { LogoMark } from '../app/components/pass-preview'
import { PassStrip, STRIP_HEIGHT, STRIP_WIDTH } from '../app/components/pass-strip'
import { BRAND } from '../app/lib/brand'
import { REWARD_AT } from '../app/lib/rules'

function png(svg: string, width: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
}

// The punched-hole mark, for the icon and logo slots.
const mark = renderToStaticMarkup(<LogoMark size={20} />).replace(
  '<svg ',
  '<svg xmlns="http://www.w3.org/2000/svg" ',
)

// Strip art per punch count, rendered at 3×. Count 9 is the reward state —
// the ninth punch earns the free coffee.
const strip = (count: number) =>
  png(
    renderToStaticMarkup(
      <PassStrip count={count} state={count >= REWARD_AT ? 'reward' : 'active'} />,
    ),
    STRIP_WIDTH * 3,
  )

const previewIndex = process.argv.indexOf('--preview')

if (previewIndex !== -1) {
  const dir = process.argv[previewIndex + 1] ?? 'pass-art'

  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'icon.png'), png(mark, 87 * 3))

  for (let count = 0; count <= REWARD_AT; count++) {
    writeFileSync(join(dir, `strip-${count}.png`), strip(count))
  }

  console.log(`Wrote icon.png and strip-0…${REWARD_AT}.png to ${dir}`)
  process.exit(0)
}

const apiKey = process.env.PASSMINT_API_KEY
const templateId = process.env.PASSMINT_TEMPLATE_ID

if (!apiKey || !templateId) {
  console.error('Set PASSMINT_API_KEY and PASSMINT_TEMPLATE_ID (or put them in .dev.vars).')
  process.exit(1)
}

const passmint = new Passmint({ apiKey })

// Templates are shared by test and live mode, so this changes the live card
// too — say which key is doing it.
console.log(
  `Updating ${templateId} with a ${passmint.mode} key (templates are shared by both modes).`,
)

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

// 1. Design: colours, labels, and change messages. A field only buzzes the
//    lock screen if it has a changeMessage; %@ becomes the new value.
const template = await passmint.templates.retrieve(templateId)
const design: TemplateDesign = {
  ...template.design,
  description: 'Punchline coffee punch card',
  logoText: 'punchline',
  backgroundColor: rgb(BRAND.cobalt),
  foregroundColor: rgb(BRAND.white),
  labelColor: rgb(BRAND.butter),
  headerFields: [
    {
      key: 'count',
      label: 'Punches',
      defaultValue: '0 / 10',
      textAlignment: 'right',
      required: false,
      changeMessage: 'Punched! %@',
    },
  ],
  primaryFields: [],
  secondaryFields: [
    {
      key: 'nextReward',
      label: 'Next reward',
      defaultValue: `${REWARD_AT} more for a free coffee`,
      textAlignment: 'natural',
      required: false,
    },
  ],
  auxiliaryFields: [],
  backFields: [
    {
      key: 'howItWorks',
      label: 'How it works',
      defaultValue:
        'Every coffee punches your card, and this pass updates itself. Nine punches and the tenth cup is on us.',
      textAlignment: 'natural',
      required: false,
    },
  ],
}

await passmint.templates.update(templateId, { design })
console.log('✓ design: colours, labels, change message on "count"')

// 2. Icon and logo: the punched-hole mark.
await passmint.templates.uploadImage(templateId, 'icon', png(mark, 87 * 3))
await passmint.templates.uploadImage(templateId, 'logo', png(mark, 50 * 3))
console.log('✓ icon and logo')

// 3. Strip art: the base strip (an empty card) plus one variant per count.
await passmint.templates.uploadImage(templateId, 'strip', strip(0))

for (let count = 0; count <= REWARD_AT; count++) {
  await passmint.templates.uploadImage(templateId, 'strip', strip(count), {
    variant: String(count),
  })
  process.stdout.write(`\r✓ strip variants 0–${count}`)
}

console.log(`\nDone. ${STRIP_WIDTH}×${STRIP_HEIGHT}pt strips, rendered at 3×.`)
console.log('Now set PASSMINT_STRIP_VARIANTS = "on" in wrangler.jsonc (or .dev.vars).')
