import { useEffect, useRef, type ReactNode } from 'react'

import { useTourStep } from '@/shared/hooks/useTourStep'
import { useTourStore } from '@/shared/store/tourStore'
import { TourTip } from '@/shared/ui/TourTip'

import { useHeldTrue } from '../hooks/useHeldTrue'
import {
  tourAnchor,
  watchTourAnchor,
  type TourAnchorStep,
} from '../lib/tourAnchor'
import { placeTourTip, type TourPlacement } from '../lib/tourPlacement'

type Props = {
  step: TourAnchorStep
  /** 그 단계를 보일 때인가 (`useTourStep`) */
  ready: boolean
  /** 떠 있는 동안 `ready` 가 풀리면 본 것으로 칩니다 — 카드 · 해역 연출처럼 닫히는 것이 곧 할 일인 단계 */
  finishOnLeave?: boolean
  /**
   * `ready` 가 이만큼(ms) 안에 돌아오면 풀린 적이 없는 것으로 칩니다 (`useHeldTrue`). 카드는 향수 고르기로 넘어가며
   * 한 번 접혔다 다시 뜨고, 해역은 이웃 해역으로 건너갈 때 연출이 잠깐 끊깁니다.
   */
  holdMs?: number
  /**
   * 차례는 그대로 두고 잠깐 그리지 않습니다 — 해도 · 결과창 · 잠수처럼 3D 가 가려진 동안. 눌러 넘겨 선 안내(`forced`)는
   * 제 조건이 안 맞아도 서 있어서, 가려진 3D 위에 혼자 뜨지 않게 화면이 알려 줍니다.
   */
  paused?: boolean
  placement: TourPlacement
  children: ReactNode
}

/**
 * 3D 의 **무엇 곁에** 서는 첫 방문 안내 — 부표 · 카드 · 해역 안내 · 미니맵 · 배 (`tourStore` 의 엔진 쪽 단계).
 *
 * 자리를 아는 것은 엔진이라, 서 있는 동안 엔진에 그 상자를 재 달라고 하고(`watchTourAnchor`) 제 rAF 안에서
 * 읽어 직접 씁니다 — 선실 말풍선(`CabinBubble`)과 같은 규율입니다. 그리는 것은 검색창 · 추천 결과의 안내와
 * 같은 종이(`TourTip`)입니다.
 *
 * NOTE: 판은 **헤더 아래**입니다 — 유리판 헤더(z-20)가 위 90px 를 덮어, 거기 서면 안내가 메뉴 밑에 깔립니다.
 * NOTE: 자리를 못 재면(부표가 안 보인다 · 카드가 닫히는 중) 안 보이게만 둡니다. 단계는 그대로 서 있어
 *   자리가 돌아오면 같은 자리에서 다시 보입니다.
 */
export function SceneTourTip({
  step,
  ready,
  finishOnLeave,
  holdMs = 0,
  paused = false,
  placement,
  children,
}: Props) {
  const live = useHeldTrue(ready, holdMs)
  const tour = useTourStep(step, live, { finishOnLeave })
  const stopTour = useTourStore((state) => state.stop)
  const area = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const visible = tour.showing && !paused

  useEffect(() => {
    if (!visible) return
    watchTourAnchor(step)

    let raf = 0
    let placed = ''
    let shown = false
    const show = (on: boolean) => {
      if (on === shown || !box.current) return
      shown = on
      box.current.style.visibility = on ? 'visible' : 'hidden'
    }
    const follow = () => {
      raf = requestAnimationFrame(follow)
      const areaEl = area.current
      const el = box.current
      const anchor = tourAnchor()
      if (!areaEl || !el || !anchor) {
        show(false)
        return
      }
      const frame = areaEl.getBoundingClientRect()
      const at = placeTourTip(
        { ...anchor, x: anchor.x - frame.left, y: anchor.y - frame.top },
        { w: el.offsetWidth, h: el.offsetHeight },
        { w: frame.width, h: frame.height },
        placement,
      )
      // 값이 바뀔 때만 씁니다 — 부표 · 배가 멈춰 있으면 DOM 을 안 건드립니다
      const key = `${at.x.toFixed(1)}|${at.y.toFixed(1)}`
      if (key !== placed) {
        placed = key
        el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`
      }
      show(true)
    }
    raf = requestAnimationFrame(follow)
    return () => {
      cancelAnimationFrame(raf)
      watchTourAnchor(null)
    }
  }, [visible, step, placement])

  if (!visible) return null

  return (
    <div
      ref={area}
      className="pointer-events-none absolute inset-x-0 top-[var(--header-h)] bottom-0 z-10 overflow-hidden"
    >
      {/* 자리를 쓰기 전에는 왼쪽 위라 안 보이는 채로 태어납니다 (`CabinBubble` 과 같은 사정) */}
      <div
        ref={box}
        data-tour-step={step}
        style={{ visibility: 'hidden' }}
        className="absolute top-0 left-0"
      >
        <TourTip
          onClose={tour.finish}
          onNext={tour.next}
          onStopAll={stopTour}
          className="mx-0"
        >
          {children}
        </TourTip>
      </div>
    </div>
  )
}
