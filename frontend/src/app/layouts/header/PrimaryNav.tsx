import { NavLink } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { CommunityMenu } from './CommunityMenu'
import { FOCUS, type Ink } from './tone'
import { useDiveOut } from './useDiveOut'
import { useWarm } from './useWarm'

/*
 * ⭐ 향수 · 브랜드 · 노트는 메인에서 누르면 곧바로 옮겨 가지 않고 **잠수 연출**로 넘어갑니다
 *   (`useDiveOut`). 여기에는 적지 않습니다 — `diveDepthOf` 가 압니다.
 * ⚠ **진열대는 잠수가 아닙니다** (2026-09-20 에 뺐습니다). 배 선실이 확대되며 안으로 들어가는
 *   별도 연출로 갈 자리라, 바다로 내려가는 축에 같이 세워 두면 둘이 서로를 흉내 냅니다.
 *   미리 받는 것(`useWarm`)은 그대로 둡니다 — 그쪽은 연출이 아니라 무게 때문입니다.
 */
const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: '향수' },
  { to: ROUTES.BRANDS, label: '브랜드' },
  { to: ROUTES.NOTES, label: '노트' },
  // 진열대는 로그인해야 보입니다 (와이어프레임: 비로그인 시 좌측 메뉴에서 제거)
  { to: ROUTES.MY_SHELF, label: '진열대', requiresAuth: true },
]

/*
 * ⚠ 지금 화면은 **밑줄만** 긋고 굵게 하지 않습니다(2026-09-16 헤더 통일). 굵게 하면
 * 글자 폭이 늘어 정중앙에 선 메뉴 다섯 개가 화면마다 조금씩 옮겨 갑니다.
 */
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
    // 가운데 칸의 정중앙. 항목 사이 60px 은 시안(1671 폭에서 62px)을 1920 규격에
    // 맞추면서 끝자리를 0 으로 둔 값입니다.
    <nav aria-label="주요 메뉴" className="justify-self-center">
      <ul className="text-body flex items-center gap-15">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={navLinkClass(ink)}
              onPointerEnter={() => warm(item.to)}
              onFocus={() => warm(item.to)}
              /* 메인에서 나갈 때만 잠수입니다 — 아니면 평소의 NavLink (`useDiveOut`) */
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
