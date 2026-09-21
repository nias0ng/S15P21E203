import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { FOCUS, type Ink } from './tone'
import { useDismissable } from './useDismissable'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

const COMMUNITY_ITEMS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유' },
]

/** 커뮤니티 ▾ — 하위가 있는 유일한 메뉴 */
export function CommunityMenu({ ink }: { ink: Ink }) {
  const { open, setOpen, containerRef } = useDismissable()
  /*
    후기 · 자유도 잠수 대상입니다 (2026-09-20). 주요 메뉴와 **같은 자리**를 씁니다 — 펼침
    메뉴라고 규칙이 다르면 같은 바다인데 어떤 문은 잠기고 어떤 문은 안 잠깁니다.
  */
  const diveOut = useDiveOut()
  const warm = useWarm()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={cn(
          'text-body transition-colors duration-120 ease-out',
          ink.text,
          ink.hover,
          FOCUS,
          ink.ring,
          open && ink.open,
        )}
      >
        커뮤니티 <span aria-hidden>▾</span>
      </button>

      {open && (
        <ul
          // 와이어프레임 기준 폭 120px
          className={cn(
            'absolute top-full left-0 z-30 mt-2.5 w-30 border',
            ink.menu,
          )}
          role="menu"
        >
          {COMMUNITY_ITEMS.map((item, index) => (
            <li key={item.to} role="none">
              <NavLink
                role="menuitem"
                to={item.to}
                onPointerEnter={() => warm(item.to)}
                onFocus={() => warm(item.to)}
                onClick={(event) => {
                  /*
                    ⚠ 메뉴는 **어느 쪽이든 닫습니다.** 잠수로 가로채면 주소가 1.4초 뒤에
                      바뀌는데, 그때까지 열려 있으면 커튼 위에 메뉴가 남습니다.
                  */
                  setOpen(false)
                  diveOut(item.to)?.(event)
                }}
                className={cn(
                  'text-caption block px-2.5 py-2.5',
                  ink.item,
                  index < COMMUNITY_ITEMS.length - 1 &&
                    cn('border-b', ink.itemRule),
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
