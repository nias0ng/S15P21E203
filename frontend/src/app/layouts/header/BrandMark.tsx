import { Link, useLocation } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { riseDepthOf } from '@/shared/lib/diveTrack'
import { opensElsewhere } from '@/shared/lib/opensElsewhere'
import { useDiveStore } from '@/shared/store/diveStore'

import { FOCUS, type Ink } from './tone'

/**
 * 로고 — 어두운 방 어디서 누르든 메인으로 떠오릅니다. 나가는 길보다 넓어서
 * `riseDepthOf` 는 목록 다섯이 아니라 그 방 전체를 봅니다.
 *
 * NOTE: 로그아웃의 `navigate(ROUTES.HOME)`(계정 메뉴)은 이 길이 아닙니다 — 로그인이
 * 풀리는데 바다로 떠오르면 무슨 일이 일어난 건지 흐려집니다.
 */
export function BrandMark({ ink }: { ink: Ink }) {
  // 떠오르는 깊이는 지금 서 있는 방의 깊이입니다. 커튼은 주소가 바뀐 뒤에 움직여
  // 어디서 왔는지 모르므로 여기서 봅니다
  const depth = riseDepthOf(useLocation().pathname)
  const startDive = useDiveStore((state) => state.start)
  return (
    <Link
      to={ROUTES.HOME}
      onClick={
        depth === null
          ? undefined
          : (event) => {
              if (opensElsewhere(event)) return
              event.preventDefault()
              startDive(ROUTES.HOME, 'rise', depth)
            }
      }
      className={cn('block shrink-0', ink.text, FOCUS, ink.ring)}
    >
      <span className="block font-serif text-[26px] leading-none font-semibold tracking-[0.12em]">
        향해
      </span>
    </Link>
  )
}
