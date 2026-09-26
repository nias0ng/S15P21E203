import { type RefObject, useEffect, useRef, useState } from 'react'

/** 내용 높이를 잴 수 있는 환경인지 — 못 재면(테스트의 jsdom 등) 쓰는 쪽이 움직임 없이 폅니다 */
export const CAN_MEASURE = typeof ResizeObserver !== 'undefined'

type Measured<T extends HTMLElement, H> = {
  /** 높이를 잴 요소에 답니다 */
  ref: RefObject<T | null>
  /** 잰 높이(px, 올림). 재기 전이나 잴 수 없는 환경에서는 `initial` 그대로입니다 */
  height: H
}

/**
 * 요소의 높이를 재고, 내용이 늘거나 줄면 다시 잽니다. 판을 px 높이로 늘리는 족자 움직임이
 * 씁니다 — `height: auto` 로는 전환이 걸리지 않습니다.
 *
 * NOTE: **받는 쪽에서 바로 구조분해하세요** — 돌려주는 객체 안에 ref 가 있어, 객체째 받아
 *   `measured.height` 로 읽으면 `react-hooks/refs` 가 막습니다.
 *
 * @param initial 재기 전의 높이. 0 이면 닫힌 채로 시작하고, `null` 이면 쓰는 쪽이 재기 전을
 *   따로 가릴 수 있습니다(예: 재기 전에는 `auto`)
 * @returns 요소에 달 `ref` 와 잰 `height`
 */
export function useMeasuredHeight<T extends HTMLElement = HTMLDivElement>(
  initial?: number,
): Measured<T, number>
export function useMeasuredHeight<T extends HTMLElement = HTMLDivElement>(
  initial: null,
): Measured<T, number | null>
export function useMeasuredHeight<T extends HTMLElement = HTMLDivElement>(
  initial: number | null = 0,
): Measured<T, number | null> {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(initial)

  useEffect(() => {
    const element = ref.current
    if (!element || !CAN_MEASURE) return
    const observer = new ResizeObserver(() =>
      setHeight(Math.ceil(element.getBoundingClientRect().height)),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, height }
}
