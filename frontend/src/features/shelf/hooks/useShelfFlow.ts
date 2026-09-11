import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

import { snapStart } from '../lib'

/**
 * 휠 한 번이 트랙을 미는 거리 배율. 마우스 휠 한 번(100px)이 칸 폭의 40% 남짓이 되어,
 * 한 번 굴리면 병 하나가 들어오고 여러 번 굴리면 그만큼 흘러갑니다.
 */
const WHEEL_GAIN = 1.2

/** 줄 단위로 오는 휠(파이어폭스)의 한 줄 높이 */
const LINE_HEIGHT = 40

/** 휠이 이만큼(ms) 조용하면 굴리기를 끝낸 것으로 보고 병 경계에 맞춰 세웁니다 */
const IDLE_MS = 110

/**
 * 트랙이 목표를 따라가는 빠르기(1/초). 목표와의 거리를 초당 이 비율로 줄여서, 굴리는
 * 동안은 휠을 바짝 따라오고 멈추면 미끄러지듯 섭니다. 크면 딱딱하고 작으면 굼뜹니다.
 */
const FOLLOW = 9

/** 목표와 이만큼(px) 가까워지면 그 자리에 세우고 멈춥니다 */
const REST_PX = 0.25

type Mode = 'rest' | 'follow' | 'tween'

type Options = {
  /** 휠을 받는 자리 */
  viewport: RefObject<HTMLElement | null>
  /** 옆으로 미는 층 */
  track: RefObject<HTMLElement | null>
  /** 칸 폭(px) */
  pitch: number
  /** 창 왼쪽 끝이 설 수 있는 마지막 칸 */
  max: number
  /** 서 있다가 움직이기 시작할 때 */
  onMoveStart: () => void
  /** 움직이는 동안 매 프레임. 위치는 칸 단위 소수입니다 */
  onMove: (position: number) => void
  /** 멈춘 칸 */
  onSettle: (start: number) => void
}

export type ShelfFlow = {
  /** 서 있거나 향하고 있는 칸 */
  destination: () => number
  /** 칸으로 흘려 보냅니다. instant 면 움직이지 않고 바로 옮깁니다 */
  go: (start: number, instant?: boolean) => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** 칩 · 페이저로 옮길 때의 곡선. 출발과 도착을 모두 부드럽게 합니다 */
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 진열대 벽을 휠로 좌우로 흘려 보냅니다.
 *
 * 위치를 px 가 아니라 **칸 단위**로 들고 있습니다. 창 크기가 바뀌어 칸 폭이 달라져도
 * 같은 병이 창 왼쪽 끝에 남습니다.
 *
 *   휠   목표에 굴린 거리를 더하고, 트랙은 목표를 부드럽게 따라갑니다(흐르듯이).
 *        휠이 멈추면 목표를 칸 경계에 맞춥니다(`snapStart`) — 창 양 끝에 병이 걸린 채
 *        서지 않고, 넘어가던 병은 끝까지 들여 세웁니다.
 *   이동 칩 · 페이저 · 화살표는 정해진 칸으로 곧장 갑니다. 거리가 멀수록 조금 오래 걸립니다.
 *
 * 위치는 요소의 transform 에 직접 씁니다. 상태로 들면 매 프레임 병 스물다섯 개가 다시
 * 그려집니다. 화면이 알아야 하는 것(멈춘 칸 · 움직이기 시작함)만 콜백으로 알립니다.
 *
 * 휠 이벤트는 React 의 onWheel 이 아니라 직접 답니다. React 는 wheel 을 passive 로
 * 붙여서 preventDefault 가 통하지 않습니다. 움직임을 줄이도록 설정한 사용자에게는
 * 흐르지 않고 멈출 자리로 바로 옮깁니다.
 */
export function useShelfFlow(options: Options): ShelfFlow {
  const [flow] = useState(createFlow)

  // 콜백과 치수는 렌더마다 바뀌므로 그린 직후마다 엔진에 새로 넣습니다
  useLayoutEffect(() => {
    flow.configure(options)
  })

  // 칸 폭이 바뀌면 같은 칸 위치를 새 폭으로 다시 그립니다
  useLayoutEffect(() => {
    flow.apply()
  }, [flow, options.pitch])

  // 검색으로 벽이 짧아지면 끝을 넘어간 창을 끌어당깁니다
  useEffect(() => {
    if (flow.destination() > options.max) flow.go(options.max, true)
  }, [flow, options.max])

  useEffect(() => {
    const element = options.viewport.current
    if (!element) return
    element.addEventListener('wheel', flow.wheel, { passive: false })
    return () => element.removeEventListener('wheel', flow.wheel)
  }, [flow, options.viewport])

  useEffect(() => () => flow.dispose(), [flow])

  return flow
}

const IDLE_OPTIONS: Options = {
  viewport: { current: null },
  track: { current: null },
  pitch: 1,
  max: 0,
  onMoveStart: () => {},
  onMove: () => {},
  onSettle: () => {},
}

function createFlow() {
  let options = IDLE_OPTIONS
  const read = () => options

  let position = 0
  let target = 0
  let mode: Mode = 'rest'
  let direction = 0
  let lastInput = 0
  let snapped = true
  let from = 0
  let startedAt = 0
  let duration = 0
  let frame = 0
  let lastFrame = 0

  const apply = () => {
    const { track, pitch } = read()
    const element = track.current
    if (!element) return
    const x = Math.round(position * pitch * 100) / 100
    element.style.transform = `translate3d(${-x}px, 0, 0)`
  }

  const finish = () => {
    mode = 'rest'
    frame = 0
    position = target
    apply()
    read().onMove(position)
    read().onSettle(Math.round(position))
  }

  const tick = (now: number) => {
    const { pitch, max } = read()
    const elapsed = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now

    if (mode === 'tween') {
      const t = Math.min(1, (now - startedAt) / duration)
      position = from + (target - from) * easeInOut(t)
      if (t >= 1) return finish()
    } else {
      if (!snapped && now - lastInput > IDLE_MS) {
        target = snapStart(target, direction, max)
        snapped = true
      }
      // 움직임을 줄인 사용자: 굴리는 동안은 서 있다가 멈출 자리로 바로 옮깁니다
      if (prefersReducedMotion()) {
        if (snapped) return finish()
        frame = requestAnimationFrame(tick)
        return
      }
      position += (target - position) * (1 - Math.exp(-FOLLOW * elapsed))
      if (snapped && Math.abs(target - position) * pitch < REST_PX) {
        return finish()
      }
    }

    apply()
    read().onMove(position)
    frame = requestAnimationFrame(tick)
  }

  const run = () => {
    if (frame) return
    lastFrame = performance.now()
    read().onMoveStart()
    frame = requestAnimationFrame(tick)
  }

  return {
    apply,

    configure(next: Options) {
      options = next
    },

    destination: () => (snapped ? target : snapStart(target, 0, read().max)),

    wheel(event: WheelEvent) {
      // 두 손가락 확대(ctrl + 휠)는 브라우저에 맡깁니다
      if (event.ctrlKey) return
      const { viewport, pitch, max } = read()
      // 트랙패드로 좌우로 밀어도 같은 방향으로 흐릅니다
      const dominant =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      if (!dominant) return
      event.preventDefault()

      const unit =
        event.deltaMode === 1
          ? LINE_HEIGHT
          : event.deltaMode === 2
            ? (viewport.current?.clientWidth ?? pitch)
            : 1
      const delta = (dominant * unit * WHEEL_GAIN) / pitch

      // 옮기던 중이면 그 목적지에서 이어 굴립니다
      mode = 'follow'
      target = clamp(target + delta, 0, max)
      direction = Math.sign(delta)
      lastInput = performance.now()
      snapped = false
      run()
    },

    go(start: number, instant = false) {
      const to = clamp(Math.round(start), 0, read().max)
      target = to
      snapped = true
      if (instant || prefersReducedMotion()) {
        cancelAnimationFrame(frame)
        return finish()
      }
      if (mode === 'rest' && position === to) return
      mode = 'tween'
      from = position
      startedAt = performance.now()
      duration = clamp(260 + 90 * Math.abs(to - position), 320, 900)
      run()
    },

    dispose() {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
