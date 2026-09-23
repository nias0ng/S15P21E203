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

export function CommunityMenu({ ink }: { ink: Ink }) {
  const { open, setOpen, containerRef } = useDismissable()
  const diveOut = useDiveOut()
  const warm = useWarm()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        lang="en"
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
        COMMUNITY <span aria-hidden>▾</span>
      </button>

      {open && (
        <ul
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
                  // NOTE: 잠수든 아니든 먼저 닫습니다 — 잠수는 주소가 1.4초 뒤에 바뀌어,
                  // 그때까지 열려 있으면 커튼 위에 메뉴가 남습니다
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
