import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { CommunityMenu } from './CommunityMenu'
import { FOCUS, type Ink } from './tone'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: 'PERFUME' },
  { to: ROUTES.BRANDS, label: 'BRAND' },
  { to: ROUTES.NOTES, label: 'NOTE' },
  { to: ROUTES.MY_SHELF, label: 'SHELF', requiresAuth: true },
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
      {/* NOTE: 좁은 폭은 사이를 줄입니다 — 로그인하면 SHELF 가 붙어 1024 아래에서 계정 단추를 덮습니다 */}
      <ul className="text-heading flex items-center gap-7.5 tracking-widest md:gap-12.5 lg:gap-25">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              // 한국어 목소리가 대문자 영어를 한 글자씩 읽지 않게 합니다
              lang="en"
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
