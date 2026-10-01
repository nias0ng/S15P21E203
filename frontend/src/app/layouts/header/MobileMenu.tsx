import { NavLink } from 'react-router'

import { cn } from '@/shared/lib/cn'

import { COMMUNITY_ITEMS, NAV_ITEMS } from './navItems'
import { FOCUS, inkLink, type Ink } from './tone'
import { useDismissable } from './useDismissable'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

function MenuIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="size-5"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  )
}

/**
 * 좁은 화면(768 아래)의 **접은 주요 메뉴** (2026-10-01 · 메인 사용성 테스트).
 *
 * 390 폭에서 가운데 메뉴 다섯 낱말이 한 줄에 서지 못해 COMMUNITY 가 'COMMUN' 에서 잘리고, 로그인 ·
 * 그래픽 설정 단추가 화면 밖으로 밀려 누를 길이 없었습니다. 줄을 하나 더 두지 않고 접는 까닭은
 * 헤더 높이(`--header-h`)를 3D 향 지도가 그대로 받아 검색창 · 해도를 그 아래로 내리기 때문입니다 —
 * 높이가 바뀌면 그 약속이 화면마다 갈라집니다.
 *
 * 목록은 넓은 화면의 것과 **같은 출처**입니다(`NAV_ITEMS` · `COMMUNITY_ITEMS`). 커뮤니티의 두 갈래는
 * 한 단 더 펼치지 않고 같은 목록에 바로 둡니다 — 접은 메뉴 안에서 또 접으면 엄지로 두 번 눌러야 합니다.
 */
export function MobileMenu({
  isLoggedIn,
  ink,
}: {
  isLoggedIn: boolean
  ink: Ink
}) {
  const { open, setOpen, containerRef } = useDismissable()
  const diveOut = useDiveOut()
  const warm = useWarm()
  const items = [
    ...NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth),
    ...COMMUNITY_ITEMS.map((item) => ({
      ...item,
      label: `커뮤니티 · ${item.label}`,
    })),
  ]

  return (
    <div ref={containerRef} className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="메뉴"
        onClick={() => setOpen(!open)}
        className={cn(
          // 아이콘은 20 이지만 누르는 자리는 손가락 크기(44)로 둡니다
          'grid size-[44px] place-items-center',
          inkLink(ink),
          FOCUS,
          ink.ring,
          open && ink.open,
        )}
      >
        <MenuIcon />
      </button>

      {open && (
        <ul
          className={cn(
            'absolute top-full right-0 z-30 mt-2.5 w-45 border',
            ink.menu,
          )}
          role="menu"
          aria-label="메뉴"
        >
          {items.map((item, index) => (
            <li key={item.to} role="none">
              <NavLink
                role="menuitem"
                to={item.to}
                onPointerEnter={() => warm(item.to)}
                onFocus={() => warm(item.to)}
                onClick={(event) => {
                  // NOTE: 잠수든 아니든 먼저 닫습니다 — 잠수는 주소가 1.4초 뒤에 바뀌어,
                  // 그때까지 열려 있으면 커튼 위에 메뉴가 남습니다 (`CommunityMenu` 와 같습니다)
                  setOpen(false)
                  diveOut(item.to)?.(event)
                }}
                className={cn(
                  'text-body block px-3.75 py-3',
                  ink.item,
                  index < items.length - 1 && cn('border-b', ink.itemRule),
                )}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
