import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

type Props = {
  /** 게시판마다 다른 한 줄 설명 */
  description: string
  /** 오른쪽 끝에 붙는 글쓰기 단추 */
  action?: React.ReactNode
}

const TABS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기 게시판' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유 게시판' },
]

/**
 * 커뮤니티 게시판 머리말 (와이어프레임 A22a · A22b 상단)
 *
 * 제목 · 설명 · 게시판 탭 · 글쓰기 단추를 한 덩어리로 묶습니다. 두 게시판이 같은
 * 머리말을 쓰므로 한 곳에 둡니다 — 나눠 두면 한쪽만 고쳐집니다.
 *
 * ── 제목이 "커뮤니티" 인 이유 ─────────────────────────────
 * 예전에는 화면 제목이 `sr-only` 여서 눈에 보이는 제목이 없었습니다. 탭이 그 자리를
 * 대신했는데, 탭은 "지금 어디" 를 말할 뿐 "여기가 무엇인지" 는 말하지 않습니다.
 * 그렇다고 "자유 게시판" 을 제목으로 쓰면 바로 아래 탭과 같은 말이 두 번 보입니다.
 * 그래서 제목은 두 게시판을 아우르는 이름이고, 어느 쪽인지는 탭이 말합니다.
 *
 * 설명을 게시판마다 다르게 받는 이유: 두 게시판은 규칙이 다릅니다(후기는 향수가
 * 반드시 붙고 자유 글은 아닙니다). 그 차이를 탭 라벨만으로는 알 수 없습니다.
 */
export function BoardHeader({ description, action }: Props) {
  return (
    <header className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-ink text-display font-serif font-bold">커뮤니티</h1>
        <p className="text-ink-muted text-body">{description}</p>
      </div>

      {/*
        탭과 단추가 한 줄에 놓입니다. 밑줄(border-b)은 줄 전체에 그어서 탭이
        그 위에 얹힌 것처럼 보이게 합니다 — 탭에만 그으면 단추 쪽이 허전합니다.
      */}
      <div className="border-line flex items-end justify-between gap-4 border-b">
        <nav aria-label="게시판" className="flex">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'text-body px-4 py-3 font-medium',
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

        {/*
          단추를 밑줄 위로 4px 띄웁니다. 줄에 딱 붙이면 단추가 탭의 일부처럼 읽혀서,
          "글을 쓴다" 와 "게시판을 옮긴다" 가 같은 종류의 조작으로 보입니다.
        */}
        {action && <div className="mb-1 shrink-0">{action}</div>}
      </div>
    </header>
  )
}
