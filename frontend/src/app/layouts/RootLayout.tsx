import { NavLink, Outlet } from 'react-router'

import { ROUTES } from '@/shared/config/routes'

const NAV_ITEMS = [
  { to: ROUTES.MAP, label: '향 지도' },
  { to: ROUTES.RECOMMEND, label: 'AI 추천' },
  { to: ROUTES.COMMUNITY, label: '커뮤니티' },
  { to: ROUTES.MY_SHELF, label: '내 진열대' },
]

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-brand-100 sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <NavLink to={ROUTES.HOME} className="text-brand-700 font-bold">
            향해
          </NavLink>
          <ul className="flex items-center gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? 'text-brand-600 font-semibold'
                      : 'text-ink-muted hover:text-ink'
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-brand-100 text-ink-muted border-t py-6 text-center text-xs">
        © 2026 향해 · SSAFY S15P21E203
      </footer>
    </div>
  )
}
