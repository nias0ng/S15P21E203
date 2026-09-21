import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { CommunityMenu } from './CommunityMenu'
import { FOCUS, type Ink } from './tone'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: '향수' },
  { to: ROUTES.BRANDS, label: '브랜드' },
  { to: ROUTES.NOTES, label: '노트' },
  { to: ROUTES.MY_SHELF, label: '진열대', requiresAuth: true },
]

// NOTE: 지금 화면은 밑줄만 긋고 굵게 하지 않습니다 — 굵게 하면 글자 폭이 늘어
// 정중앙에 선 메뉴가 화면마다 조금씩 옮겨 갑니다
const navLinkClass =
  (ink: Ink) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      'block transition-colors duration-120 ease-out',
      ink.text,
      ink.hover,
      FOCUS,
      ink.ring,
      isActive && 'underline underline-offset-[6px]',
    )

export function PrimaryNav({
  isLoggedIn,
  ink,
}: {
  isLoggedIn: boolean
  ink: Ink
}) {
  const items = NAV_ITEMS.filter((item) => isLoggedIn || !item.requiresAuth)
  const diveOut = useDiveOut()
  const warm = useWarm()

  return (
    <nav aria-label="주요 메뉴" className="justify-self-center">
      <ul className="text-body flex items-center gap-15">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={navLinkClass(ink)}
              onPointerEnter={() => warm(item.to)}
              onFocus={() => warm(item.to)}
              onClick={diveOut(item.to)}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <CommunityMenu ink={ink} />
        </li>
      </ul>
    </nav>
  )
}
