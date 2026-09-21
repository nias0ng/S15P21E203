import { Link, useLocation } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { riseDepthOf } from '@/shared/lib/diveTrack'
import { useDiveStore } from '@/shared/store/diveStore'

import { FOCUS, type Ink } from './tone'
import { opensElsewhere } from './useDiveOut'

/**
 * 로고 — 이름 한 줄.
 *
 * ⭐ **어두운 방 어디서 누르든 떠오릅니다** (2026-09-19 · 2026-09-20 다섯 화면으로 · 상세까지).
 * 거기서 메인으로 가는 길이 여기 하나뿐이라 돌아오는 연출의 입구도 여기입니다.
 * ⚠ 나가는 길보다 **넓습니다** — `riseDepthOf` 는 목록 다섯이 아니라 그 **방 전체**를 봅니다
 *   (까닭은 그 함수 주석). 들어가는 문만 좁습니다.
 * ⚠ 로그아웃의 `navigate(ROUTES.HOME)`(계정 메뉴)은 이 길이 아닙니다 — 로그인이
 *   풀리는데 바다로 떠오르면 무슨 일이 일어난 건지 흐려집니다.
 */
export function BrandMark({ ink }: { ink: Ink }) {
  /*
    떠오르는 깊이는 **지금 서 있는 방**의 깊이입니다 — 내려간 만큼 올라옵니다. 상세에 있어도
    그 방의 목록이 내려온 깊이를 그대로 씁니다.
    ⚠ 그래서 주소를 여기서 봅니다. 커튼은 이미 주소가 바뀐 뒤에 움직여서 어디서 왔는지 모릅니다.
  */
  const depth = riseDepthOf(useLocation().pathname)
  const startDive = useDiveStore((state) => state.start)
  return (
    <Link
      to={ROUTES.HOME}
      onClick={
        /*
          콘텐츠 화면에서 누를 때만 가로챕니다 — 커튼이 위에서 덮은 **뒤에** 커튼이 옮겨 갑니다.
          ⚠ 뒤로 가기(브라우저)는 못 가로챕니다 — 그때는 평소대로 넘어갑니다.
        */
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
