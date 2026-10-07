import { Link, NavLink } from 'react-router'
import { AboutDialog } from './about-dialog'
import { GitHubMark } from './github-mark'
import { LogoMark } from './pass-preview'
import { PassmintMark } from './passmint-mark'

const navLink =
  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-cobalt-500'

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5">
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt-500"
      >
        <LogoMark size={24} />
        <span className="type-wide text-xl leading-none sm:text-2xl">punchline</span>
        <span className="flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-2.5 py-1 text-ink-900 max-sm:hidden">
          <PassmintMark size="sm" />
          <span className="text-sm text-ink-600">demo</span>
        </span>
      </Link>
      <nav className="-mr-3 flex items-center">
        <AboutDialog className={navLink} />
        <NavLink
          to="/counter"
          className={({ isActive }) => `${navLink} ${isActive ? 'bg-ink-900/5 text-ink-900' : ''}`}
        >
          Counter
        </NavLink>
        <a
          href="https://github.com/getpassmint/punchline"
          className={`${navLink} flex items-center gap-1.5 max-sm:hidden`}
        >
          <GitHubMark />
          View source
        </a>
      </nav>
    </header>
  )
}
