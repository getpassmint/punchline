import { SiteHeader } from './site-header'

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}
