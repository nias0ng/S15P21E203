import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

/**
 * 게시판 탭 (와이어프레임 A22a · A22b 상단)
 *
 * 후기 · 자유 두 게시판을 오갑니다. 헤더의 커뮤니티 드롭다운과 같은 목적지이고,
 * 게시판 안에서도 바로 전환할 수 있게 둡니다.
 */
export function BoardTabs() {
  return (
    <nav aria-label="게시판" className="border-line flex border-b">
      {[
        { to: ROUTES.COMMUNITY_REVIEWS, label: '후기 게시판' },
        { to: ROUTES.COMMUNITY_FREE, label: '자유 게시판' },
      ].map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'px-4 py-2.5 text-xs transition-colors',
              isActive
                ? 'border-ink text-ink -mb-px border-b-2 font-bold'
                : 'text-ink-muted hover:text-ink',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
