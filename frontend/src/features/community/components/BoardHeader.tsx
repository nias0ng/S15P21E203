import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

type Props = {
  /** 오른쪽 끝에 붙는 글쓰기 단추 */
  action?: React.ReactNode
}

const TABS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기 게시판' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유 게시판' },
]

/** 커뮤니티 게시판 머리말 (A22a · A22b 상단). 두 게시판이 같이 씁니다. */
export function BoardHeader({ action }: Props) {
  return (
    <header className="space-y-6.25">
      <h1 className="text-ink text-display text-center font-serif font-bold">
        커뮤니티
      </h1>

      {/*
        **1fr | auto | 1fr** 입니다. `justify-between` 으로 두면 단추가 한쪽에만
        있어 탭이 왼쪽 끝으로 밀립니다 — 왼쪽 빈 칸은 자리를 지켜야 해서 둡니다.
      */}
      <div className="border-line grid grid-cols-[1fr_auto_1fr] items-end gap-3.75 border-b">
        <div aria-hidden />

        <nav aria-label="게시판" className="flex justify-center">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'text-body px-3.75 py-2.5 font-medium',
                  'transition-colors duration-120 ease-out',
                  'focus-visible:ring-accent-deep rounded-t-card outline-none focus-visible:ring-2',
                  isActive
                    ? 'border-ink text-ink -mb-px border-b-2'
                    : 'text-ink-muted hover:text-ink border-b-2 border-transparent',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="mb-1.25 flex justify-end">{action}</div>
      </div>
    </header>
  )
}
