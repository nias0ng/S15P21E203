import { useEffect, useRef, useState } from 'react'

/*
 * 족자처럼 위에서 아래로 풀리는 움직임.
 *
 * 메인(3D 향 지도)의 **향해 일지**가 쓰는 것과 같은 값입니다 (2026-09-17 사용자 :
 * "지도 · 종이를 열듯 두루마리가 열리는 모션 · 위→아래 족자"). 머리줄이 족자의 위 축이고
 * 그 아래 종이가 위에서부터 풀려 내려옵니다.
 *
 * ⚠️ **글자는 제자리에 있습니다.** 줄마다 떠오르게 하지 않습니다 — 종이에 적힌 글자는
 *   움직이지 않고, 판 아래끝이 지나가며 드러날 뿐입니다.
 * ⚠️ **높이를 px 로 재서 늘립니다.** `grid-template-rows: 0fr → 1fr` 은 바깥 판이 글자가
 *   보이는 칸보다 앞서 내려갑니다 — 자동 높이 격자에서 1 보다 작은 fr 이 두 번 곱해져,
 *   판 아래가 빈 채로 먼저 내려옵니다 (향해 일지에서 09-17 실측 : 280ms 에 판 219px ·
 *   글자 116px).
 * ⚠️ 풀 때는 천천히 떼어 끝에서 조용히 멈춥니다 (사용자 "튀어나오면 안 됨").
 *
 * ⚠️ 같은 값이 `features/map` 의 `VoyageLog` 에도 있습니다. 그쪽은 접기 단추 · 폭에 따른
 *   기본값까지 얽혀 있어 이 훅으로 옮기지 않았습니다 — 움직임을 고칠 때 **두 곳을 같이**
 *   봅니다. 일지를 이 훅으로 옮기는 것은 따로 합니다.
 */

/** 풀리는 곡선 — 끝에서 천천히 멈춥니다 */
export const UNROLL_CURVE = 'ease-[cubic-bezier(0.45,0,0.2,1)]'

/** 풀 때. 말아 올릴 때(`duration-450`)보다 느립니다 — 펴는 것은 조심스럽고 걷는 것은 빠릅니다 */
export const UNROLL = `duration-700 ${UNROLL_CURVE}`

/** 내용 높이를 잴 수 있는 환경인지 — 못 재면(테스트의 jsdom 등) 움직임 없이 폅니다 */
const CAN_MEASURE = typeof ResizeObserver !== 'undefined'

/**
 * 마운트되면 **닫힌 모양을 한 번 칠한 뒤** 풀립니다.
 *
 * 두 프레임을 기다리는 이유: 첫 프레임에 높이 0 이 실제로 그려져야 브라우저가 전환할
 * 시작값을 갖습니다. 바로 열면 0 을 건너뛰고 완성된 높이로 튀어나옵니다.
 *
 * 그래서 **여는 쪽에서 이 훅을 쓰는 부분을 조건부로 렌더해야 합니다** — 닫혀 있을 때
 * 내용을 DOM 에 남겨 두면 다음에 열 때 다시 풀리지 않습니다.
 *
 * 내용이 나중에 바뀌어도(불러오는 중 → 결과) 다시 재서 그만큼 이어서 풀립니다.
 *
 * ⚠️ **받는 쪽에서 바로 구조분해하세요** — `const { bodyRef, style, inert } = useUnroll()`.
 *   `const unroll = useUnroll()` 로 받아 `unroll.style` 처럼 쓰면 `react-hooks/refs` 가
 *   막습니다("Cannot access refs during render"). 돌려주는 객체 안에 ref 가 있어서 그
 *   객체 전체를 ref 로 보기 때문이고, ref 가 아닌 `style` · `inert` 까지 함께 걸립니다.
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
     * ⚠️ **rAF 가 아예 안 도는 환경이 있습니다** — 숨겨진 탭 · 창 밖으로 나간 미리보기처럼
     * 브라우저가 그리기를 멈춘 곳입니다. 거기서는 두 프레임이 영영 오지 않아 판이 **0 인 채로
     * 남고**, 사람 눈에는 머리줄만 있는 빈 모달이 됩니다 (2026-09-18 실측 : 미리보기 패널이
     * 숨겨진 동안 800ms 에 0 프레임).
     *
     * 그래서 시계로도 한 번 엽니다. 그리는 중인 창에서는 두 프레임(≈32ms)이 먼저 도착해
     * 이쪽은 하는 일이 없고, 멈춘 창에서는 이쪽이 뒤늦게 열어 줍니다 — 그때는 움직임 없이
     * 그냥 펼쳐지지만, **안 보이는 것보다 낫습니다.**
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
