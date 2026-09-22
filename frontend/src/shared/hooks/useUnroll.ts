import { useEffect, useRef, useState } from 'react'

/*
 * 족자처럼 위에서 아래로 풀리는 움직임. 메인의 **향해 일지**와 같은 값입니다.
 *
 * NOTE: **높이를 px 로 재서 늘립니다.** `grid-template-rows: 0fr → 1fr` 은 자동 높이
 *   격자에서 1 보다 작은 fr 이 두 번 곱해져, 판 아래가 빈 채로 글자보다 먼저
 *   내려옵니다 (09-17 실측 : 280ms 에 판 219px · 글자 116px).
 * NOTE: 같은 값이 `features/map` 의 `VoyageLog` 에도 있습니다 — 움직임을 고칠 때
 *   **두 곳을 같이** 봅니다.
 */

/** 풀리는 곡선 — 끝에서 천천히 멈춥니다 */
const UNROLL_CURVE = 'ease-[cubic-bezier(0.45,0,0.2,1)]'

/** 펴는 것은 조심스러워 느리게 둡니다. 이 훅은 펴기만 하고 말아 올리지 않습니다 */
export const UNROLL = `duration-700 ${UNROLL_CURVE}`

/** 내용 높이를 잴 수 있는 환경인지 — 못 재면(테스트의 jsdom 등) 움직임 없이 폅니다 */
const CAN_MEASURE = typeof ResizeObserver !== 'undefined'

/**
 * 마운트되면 **닫힌 모양을 한 번 칠한 뒤** 풀립니다. 첫 프레임에 높이 0 이 실제로
 * 그려져야 브라우저가 전환할 시작값을 가져서, 두 프레임을 기다립니다. 그래서
 * **쓰는 쪽을 조건부로 렌더해야 합니다** — 닫혀 있을 때 DOM 에 남겨 두면 다음에
 * 열 때 다시 풀리지 않습니다.
 *
 * NOTE: **받는 쪽에서 바로 구조분해하세요** — `const unroll = useUnroll()` 로 받아
 *   `unroll.style` 로 쓰면 `react-hooks/refs` 가 막습니다("Cannot access refs during
 *   render"). 객체 안에 ref 가 있어 객체 전체를 ref 로 봅니다.
 */
export function useUnroll() {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setExpanded(true))
    })
    /*
     * NOTE: **rAF 가 아예 안 도는 환경이 있습니다** — 숨겨진 탭 · 창 밖 미리보기에서는 두
     * 프레임이 영영 안 와 판이 **0 인 채로 남습니다**(09-18 실측 : 800ms 에 0 프레임).
     * 그래서 시계로도 한 번 엽니다 — 그리는 창에서는 rAF 가 먼저 도착합니다.
     */
    const fallback = window.setTimeout(() => setExpanded(true), 250)
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      window.clearTimeout(fallback)
    }
  }, [])

  useEffect(() => {
    const body = bodyRef.current
    if (!body || !CAN_MEASURE) return
    const observer = new ResizeObserver(() =>
      setHeight(Math.ceil(body.getBoundingClientRect().height)),
    )
    observer.observe(body)
    return () => observer.disconnect()
  }, [])

  return {
    /** 풀릴 종이 — 이 요소의 높이를 잽니다 */
    bodyRef,
    /** 감싼 칸에 그대로 넘깁니다 (`overflow-hidden transition-[height]` 과 함께) */
    style: {
      height: expanded ? (CAN_MEASURE ? height : 'auto') : 0,
    },
    /** 아직 풀리는 중이면 그 안의 것을 건너뛰게 합니다 */
    inert: !expanded,
  }
}
