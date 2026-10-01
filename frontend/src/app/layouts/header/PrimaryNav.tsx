import { NavLink } from 'react-router'

import { cn } from '@/shared/lib/cn'

import { CommunityMenu } from './CommunityMenu'
import { NAV_ITEMS } from './navItems'
import { inkLink, type Ink } from './tone'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

// NOTE: 지금 화면은 밑줄만 긋고 굵게 하지 않습니다 — 굵게 하면 글자 폭이 늘어
// 정중앙에 선 메뉴가 화면마다 조금씩 옮겨 갑니다
const navLinkClass =
  (ink: Ink) =>
  ({ isActive }: { isActive: boolean }) =>
    cn('block', inkLink(ink), isActive && 'underline underline-offset-[6px]')

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
    /*
      ⚠️ 768 아래에서는 숨기고 오른쪽의 접은 메뉴(`MobileMenu`)가 대신합니다 (2026-10-01). 390 폭에서
      다섯 낱말이 한 줄에 서지 못해 COMMUNITY 가 잘리고 로그인 · 그래픽 설정이 화면 밖으로 밀렸습니다.
    */
    <nav aria-label="주요 메뉴" className="hidden justify-self-center md:block">
      {/* NOTE: 좁은 폭은 사이를 줄입니다 — 로그인하면 SHELF 가 붙어 1024 아래에서 계정 단추를 덮습니다 */}
      <ul className="text-body flex items-center gap-7.5 tracking-widest md:gap-12.5 lg:gap-20">
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
