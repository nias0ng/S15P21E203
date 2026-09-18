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
 * 두 게시판이 같은 머리말을 씁니다. 제목이 "커뮤니티" 인 이유: 게시판 이름을
 * 제목으로 쓰면 바로 아래 탭과 같은 말이 두 번 보입니다.
 * 설명을 게시판마다 받는 이유: 두 게시판은 규칙이 다른데 탭 라벨만으로는 모릅니다.
 *
 * **축을 가운데로 세웁니다.** 향수 목록(A33) · 브랜드(A34) · 노트(A35)는 가운데
 * 검색창을 기준으로 위쪽이 가운데 정렬인데, 커뮤니티만 왼쪽이면 상단 메뉴로 오갈
 * 때마다 제목을 찾는 눈이 좌우로 건너뜁니다. 커뮤니티에는 검색창이 없어 그 자리를
 * 제목 · 설명 · 탭이 대신 씁니다.
 */
export function BoardHeader({ description, action }: Props) {
  return (
    <header className="space-y-6.25">
      <div className="space-y-2.5 text-center">
        <h1 className="text-ink text-display font-serif font-bold">커뮤니티</h1>
        <p className="text-ink-muted text-body">{description}</p>
      </div>

      {/*
        탭과 단추가 한 줄에 놓입니다. 밑줄(border-b)은 줄 전체에 그어서 탭이
        그 위에 얹힌 것처럼 보이게 합니다 — 탭에만 그으면 단추 쪽이 허전합니다.

        `justify-between` 이 아니라 **1fr | auto | 1fr** 인 이유: 단추가 한쪽에만
        있어서 `between` 으로 두면 탭이 왼쪽 끝으로 밀려 제목과 축이 어긋납니다.
        양쪽에 같은 크기의 빈 칸을 두면 단추가 있든 없든 탭이 줄 한가운데에
        섭니다(왼쪽 칸은 비어 있지만 자리를 지켜야 해서 지우지 않습니다).
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

        {/*
          단추를 밑줄 위로 4px 띄웁니다. 줄에 딱 붙이면 단추가 탭의 일부처럼 읽혀서,
          "글을 쓴다" 와 "게시판을 옮긴다" 가 같은 종류의 조작으로 보입니다.
        */}
        <div className="mb-1.25 flex justify-end">{action}</div>
      </div>
    </header>
  )
}
