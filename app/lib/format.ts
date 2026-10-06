// Shared by server and client renders; callers mark the element
// suppressHydrationWarning, since "now" differs between the two.
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)

  if (seconds < 10) {
    return 'just now'
  }

  if (seconds < 60) {
    return `${Math.floor(seconds)}s ago`
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return `${Math.floor(seconds / 86400)}d ago`
}

export function walletName(platform: 'apple' | 'google' | null): string {
  return platform === 'google' ? 'Google Wallet' : platform === 'apple' ? 'Apple Wallet' : 'wallet'
}
