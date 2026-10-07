// Shared button styles. All actions are 48px tall to match the wallet badges.
const base =
  'inline-flex h-12 items-center rounded-full px-6 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60'

const variants = {
  primary: 'bg-cobalt-500 text-white hover:bg-cobalt-600 focus-visible:outline-butter-400',
  reward: 'bg-butter-400 text-ink-900 hover:bg-butter-600 focus-visible:outline-cobalt-500',
  secondary:
    'border border-ink-900/15 bg-white font-medium text-ink-900 hover:border-ink-900/30 focus-visible:outline-cobalt-500',
}

export const button = (variant: keyof typeof variants = 'primary') => `${base} ${variants[variant]}`
