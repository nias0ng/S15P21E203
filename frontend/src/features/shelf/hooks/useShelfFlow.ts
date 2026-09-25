import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

import {
  meterWheel,
  nearStop,
  snapStart,
  springStep,
  WHEEL_IDLE,
  wheelStop,
} from '../lib'

/** 손가락이 이만큼(px) 옆으로 가야 끌기로 봅니다. 그 전에 떼면 병을 누른 것입니다 */
const DRAG_SLOP = 8

/** 손을 뗀 속도(px/ms)에 곱해 더 흘려 보내는 시간(ms). 튕기듯 떼면 그만큼 더 갑니다 */
const FLING_MS = 160

/*
 * 멈출 칸에 붙는 용수철(lib.ts 의 springStep). 휠 · 끌기를 뗀 뒤에 씁니다.
 *
 *   고유 진동수 14 · 감쇠비 1.25  휠 한 번(1920 에서 한 칸 182.5px)이 0.38초에 90% 를 가고, 남은 10% 를
 *                                 0.5초에 걸쳐 천천히 들어가 0.9초에 섭니다. 넘지 않습니다
 *   속도 한도 24 칸/초            여러 번 쌓아 굴려도 1920 에서 한 프레임 73px 남짓까지만 건너뜁니다
 *
 * 감쇠비를 1 보다 크게 둬서(과감쇠) 출발은 빠르고 끝은 느립니다 — 칸에 가까워질수록 자석에 끌려
 * 들어가듯 천천히 붙어, 창 끝에 걸친 병이 걸친 채 스르르 당겨져 섭니다. 예전 고유 진동수 18 · 감쇠비
 * 0.8 은 0.43초 만에 2px 넘었다 딸깍 붙어, 걸친 병이 휙 들어왔다 튕기듯 섰습니다. 벽 양 끝으로도
 * 넘지 않아 따로 감쇠비를 올리지 않습니다.
 *
 * 예전에는 굴린 만큼 목표를 옮겨 따라가다 110ms 조용하면 칸 경계에 맞췄는데, 맞추는 순간 목표가
 * 멀어져 속도가 3.4 배로 튀었습니다. 용수철은 목적지가 바뀌어도 속도를 이어서 튀지 않습니다.
 */
const SPRING_OMEGA = 14
const SPRING_DAMPING = 1.25
const SPRING_MAX_SPEED = 24
/** 용수철을 굴리는 한 걸음(초). 프레임이 이보다 길면 여러 걸음으로 나눠 굴립니다 */
const SPRING_STEP = 1 / 120
/** 목적지와 이만큼(px) 가깝고 이보다(px/초) 느리면 그 칸에 세우고 멈춥니다 */
const REST_PX = 0.5
const REST_SPEED_PX = 10

/*
 * 칩 · 이름표 벽 · 페이저 · 화살표로 정해진 칸까지 옮길 때(glide) 걸리는 시간.
 *
 *   시간 = 220 + 170 x √(옮기는 칸 수) ms, 380 ~ 1300 사이
 *
 * 예전에는 칸 수에 곧게 비례하다 900ms 에서 잘라서, 먼 분류로 갈 때 스물여섯 칸(1920 에서
 * 5850px)을 900ms 에 가느라 가장 빠른 순간 한 프레임에 300px 넘게 건너뛰었습니다. 제곱근으로
 * 늘리면 가까운 곳은 예전과 비슷하고(한 칸 390 · 세 칸 515), 먼 곳은 조금 더 오래(여섯 칸
 * 635 · 스물여섯 칸 1085) 걸리면서 한 프레임에 건너뛰는 거리가 절반 아래(140px 남짓)로 줍니다.
 */
const GLIDE_BASE_MS = 220
const GLIDE_PER_SLOT_MS = 170
const GLIDE_MIN_MS = 380
const GLIDE_MAX_MS = 1300

/**
 * 움직이던 중에 새로 옮기면 그 속도를 이어받는데(glideCarry), 이어받는 거리를 옮기는 거리의
 * 이 배수까지로 묶습니다. 같은 쪽으로 2.47 배를 넘게 이어받으면 목적지를 지나쳤다 돌아옵니다.
 */
const GLIDE_CARRY_LIMIT = 2

/** 서 있음 · 용수철로 칸에 붙는 중(휠 · 끌기를 뗀 뒤) · 정해진 칸으로 옮기는 중 · 손가락으로 끄는 중 */
type Mode = 'rest' | 'spring' | 'tween' | 'drag'

type Options = {
  /** 휠을 받는 자리 */
  viewport: RefObject<HTMLElement | null>
  /** 옆으로 미는 층 */
  track: RefObject<HTMLElement | null>
  /** 칸 폭(px) */
  pitch: number
  /** 창 왼쪽 끝이 설 수 있는 마지막 칸 */
  max: number
  /**
   * 창 왼쪽 끝이 멈출 수 있는 칸들(lib.ts 의 wallStops). 이름표 벽 기둥이 창 경계에 잘리는 칸은
   * 빠져 있어서, 휠은 그 칸을 건너뛰고 칩 · 화살표는 가던 쪽의 다음 멈출 자리로 비켜섭니다(nearStop).
   */
  stops: readonly number[]
  /** 패널에 가리지 않는 칸 수. 휠을 연달아 굴려 지금 자리보다 앞서 쌓을 수 있는 칸 수의 한도입니다 */
  clear: number
  /**
   * 벽 끝에 서 있을 때 그 너머로 굴린 휠을 막지 않고 페이지 스크롤로 넘깁니다(쌓는 배치). 한 장
   * 배치는 페이지가 스크롤되지 않아서 늘 휠을 받습니다.
   */
  pageScrollAtEnds?: boolean
  /** 서 있다가 움직이기 시작할 때 */
  onMoveStart: () => void
  /** 움직이는 동안 매 프레임. 위치는 칸 단위 소수입니다 */
  /** 흐르는 동안 매 프레임. 벽에 한 분류만 서는 배치에서는 들을 것이 없어 선택입니다 */
  onMove?: (position: number) => void
  /** 멈춘 칸 */
  onSettle: (start: number) => void
}

export type ShelfFlow = {
  /** 서 있거나 향하고 있는 칸 */
  destination: () => number
  /** 칸으로 흘려 보냅니다. instant 면 움직이지 않고 바로 옮깁니다 */
  go: (start: number, instant?: boolean) => void
  /**
   * 벽 앞쪽에 칸이 늘거나 줄었을 때 부릅니다 — 지금 자리 · 향하던 칸 · 흐름을 **같은 칸 수만큼**
   * 옮겨, 화면의 병은 그대로 두고 좌표만 새 벽에 맞춥니다. 흐르던 중이면 그대로 이어 흐릅니다.
   * 알리지(onSettle) 않습니다. 분류를 바꾸며 벽 앞에 새 분류를 끼우거나 옛 분류를 뺄 때 씁니다(ShelfWall).
   */
  rebase: (offset: number) => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * 칩 · 이름표 벽 · 페이저 · 화살표로 옮길 때의 곡선(사인). 출발과 도착을 모두 부드럽게
 * 하되, 가장 빠른 순간이 평균 속도의 1.57 배라 예전 3차 곡선(3 배)보다 한가운데에서 덜 튑니다.
 */
const glideEase = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

/**
 * 움직이던 속도를 이어받는 몫(3차 에르미트 곡선의 출발 기울기 항). 0 과 1 에서 0 이고,
 * 기울기가 출발에서 1 · 도착에서 0 입니다.
 *
 *   위치 = 출발 + 옮기는 거리 x glideEase(t) + 이어받은 거리 x glideCarry(t)
 *
 * 이어받은 거리 = 움직이던 속도 x 걸리는 시간. 그래서 출발하는 순간의 속도가 움직이던 속도와
 * 같고 도착하는 순간에는 멈춥니다. 화살표를 연달아 누르거나 흐르는 중에 칩을 눌러도 벽이
 * 뚝 섰다가 다시 출발하지 않습니다.
 */
const glideCarry = (t: number) => t * (1 - t) ** 2

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 진열대 벽을 휠로 좌우로 흘려 보냅니다.
 *
 * 위치를 px 가 아니라 **칸 단위**로 들고 있습니다. 창 크기가 바뀌어 칸 폭이 달라져도
 * 같은 병이 창 왼쪽 끝에 남습니다.
 *
 *   휠   **한 번 = 한 칸**입니다. 마우스 휠 한 번(배율에 따라 66.7 ~ 150), 파이어폭스의 줄 단위,
 *        맥 마우스의 작은 한 번이 모두 한 칸이고, 트랙패드는 칸 폭의 절반만큼 밀 때마다 한 칸입니다
 *        (lib.ts 의 meterWheel). 향하는 칸(목적지)은 늘 멈출 수 있는 정수 칸이고, 벽은 용수철로
 *        그 칸에 끌려가 **자석처럼 딸깍 붙습니다**(springStep).
 *        흐르는 중에 같은 쪽으로 또 굴리면 목적지에 한 칸씩 쌓이고(가리지 않는 칸 수까지), 반대로
 *        굴리면 지금 자리에서 그쪽 다음 칸으로 곧바로 돌아섭니다(wheelStop). 목적지가 바뀌어도
 *        속도를 이어서 튀거나 끊기지 않습니다. 이름표 벽 기둥이 창 경계에 잘리는 막힌 자리는
 *        건너뛰어서, 기둥은 휠 한 번에 통째로 지나갑니다(`stops`).
 *        벽 끝에서 더 굴리면 아무 일도 없습니다 — 움직이기 시작했다고 알리지 않아서 패널 흐림 ·
 *        창 끝 병 · 태그가 깜빡이거나 흔들리지 않습니다.
 *   이동 칩 · 이름표 벽 · 페이저 · 화살표는 정해진 칸으로 곧장 갑니다(glide). 거리가 멀수록
 *        조금 오래 걸리고, 움직이던 중이면 그 속도를 이어받아 출발합니다. 옮기는 중에 휠을
 *        굴리면 흐르던 속도 그대로 용수철이 이어받습니다. 손가락으로 잡아도 그 자리에서 잡힙니다.
 *   끌기 손가락(터치 · 펜)으로 끌면 트랙이 손가락을 그대로 따르고, 떼면 뗀 속도만큼 더 흘러갈
 *        칸을 정해(snapStart) 용수철이 뗀 속도 그대로 이어받아 붙입니다. 마우스 끌기는 받지
 *        않습니다 — 병을 누르는 동작과 겹칩니다. 세로로 끌면 페이지가 스크롤됩니다(ShelfWall 의
 *        touch-action: pan-y).
 *
 * 위치는 요소의 transform 에 직접 씁니다. 상태로 들면 매 프레임 병 스물다섯 개가 다시
 * 그려집니다. 화면이 알아야 하는 것(멈춘 칸 · 움직이기 시작함)만 콜백으로 알립니다. 흐르는 중이라는
 * 표시(data-moving)도 화면이 상태가 아니라 DOM 에 직접 씁니다(ShelfWall).
 *
 * 마우스를 올린 병 키우기는 마우스를 실제로 움직였을 때만 겁니다. 마우스를 움직이면 휠을 받는 자리에
 * data-pointer 를 붙이고, 휠을 굴리면 뗍니다 — 휠로 흘린 벽이 설 때 가만히 있던 커서 밑의 병이 툭
 * 커지지 않습니다(shelf-display.css 의 "마우스를 올린 병").
 *
 * 휠 이벤트는 React 의 onWheel 이 아니라 직접 답니다. React 는 wheel 을 passive 로
 * 붙여서 preventDefault 가 통하지 않습니다. 쌓는 배치에서는 벽 끝에 서 있을 때 그 너머로 굴린
 * 휠을 막지 않아 페이지가 이어서 스크롤됩니다(`pageScrollAtEnds`). 움직임을 줄이도록 설정한
 * 사용자에게는 흐르지 않고 멈출 자리로 바로 옮깁니다 — 휠도 한 번에 한 칸씩 바로 옮깁니다.
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

  // 창 크기가 바뀌어 서 있던(향하던) 칸이 막힌 자리가 되면(기둥이 창 경계에 잘림) 옆 멈출 자리로 옮깁니다
  useEffect(() => {
    flow.realign()
  }, [flow, options.stops])

  useEffect(() => {
    const element = options.viewport.current
    if (!element) return
    element.addEventListener('wheel', flow.wheel, { passive: false })
    element.addEventListener('pointerdown', flow.pointerDown)
    element.addEventListener('pointermove', flow.pointerMove)
    element.addEventListener('pointerup', flow.pointerUp)
    element.addEventListener('pointercancel', flow.pointerUp)
    // 끌고 난 뒤의 click 을 병 단추보다 먼저 받아야 해서 capture 로 답니다
    element.addEventListener('click', flow.click, true)
    return () => {
      element.removeEventListener('wheel', flow.wheel)
      element.removeEventListener('pointerdown', flow.pointerDown)
      element.removeEventListener('pointermove', flow.pointerMove)
      element.removeEventListener('pointerup', flow.pointerUp)
      element.removeEventListener('pointercancel', flow.pointerUp)
      element.removeEventListener('click', flow.click, true)
    }
  }, [flow, options.viewport])

  useEffect(() => () => flow.dispose(), [flow])

  return flow
}

const IDLE_OPTIONS: Options = {
  viewport: { current: null },
  track: { current: null },
  pitch: 1,
  max: 0,
  stops: [0],
  clear: 1,
  onMoveStart: () => {},
  onMove: () => {},
  onSettle: () => {},
}

function createFlow() {
  let options = IDLE_OPTIONS
  const read = () => options

  /** 창 왼쪽 끝의 위치(칸, 소수) */
  let position = 0
  /** 향하는 칸 — 늘 멈출 수 있는 정수 칸이고, 서 있으면 position 과 같습니다 */
  let dest = 0
  let mode: Mode = 'rest'
  /** 용수철의 속도(칸/초) */
  let velocity = 0
  /** 휠 계량기(lib.ts 의 meterWheel) */
  let meter = WHEEL_IDLE
  let from = 0
  let startedAt = 0
  let duration = 0
  /** 옮기기(tween)가 이어받은 거리(칸). 움직이던 속도 x 걸리는 시간입니다(glideCarry) */
  let carry = 0
  /** 옮기기 · 끌기에서 잰 속도(칸/ms). 새로 옮기거나 휠로 넘겨받을 때 이어 씁니다 */
  let speed = 0
  let frame = 0
  let lastFrame = 0

  /** 손가락으로 끄는 중. 끌기로 넘어가기 전(DRAG_SLOP 안)에는 moved 가 false 입니다 */
  let drag: {
    id: number
    startX: number
    from: number
    lastX: number
    lastTime: number
    /** px/ms, 오른쪽이 + */
    velocity: number
    moved: boolean
  } | null = null
  /** 끌고 난 뒤 손을 떼면 그 자리 병에 click 이 한 번 옵니다. 그 click 을 버립니다 */
  let swallowClick = false

  const apply = () => {
    const { track, pitch } = read()
    const element = track.current
    if (!element) return
    const x = Math.round(position * pitch * 100) / 100
    element.style.transform = `translate3d(${-x}px, 0, 0)`
  }

  const finish = () => {
    cancelAnimationFrame(frame)
    frame = 0
    mode = 'rest'
    speed = 0
    velocity = 0
    position = dest
    apply()
    read().onMove?.(position)
    read().onSettle(dest)
  }

  /** 지금 움직이는 속도(칸/ms) */
  const currentSpeed = () => (mode === 'spring' ? velocity / 1000 : speed)

  const tick = (now: number) => {
    const { pitch, max } = read()
    // 첫 프레임의 시각이 run() 을 부른 시각보다 앞설 수 있어 0 아래로 내려가지 않게 합니다
    const frameMs = Math.max(0, now - lastFrame)
    const elapsed = Math.min(0.05, frameMs / 1000)
    lastFrame = now
    const before = position

    if (mode === 'tween') {
      const t = clamp((now - startedAt) / duration, 0, 1)
      position = clamp(
        from + (dest - from) * glideEase(t) + carry * glideCarry(t),
        0,
        max,
      )
      if (t >= 1) return finish()
    } else {
      // 움직임을 줄인 사용자: 끌기를 뗀 뒤에도 멈출 자리로 바로 옮깁니다
      if (prefersReducedMotion()) return finish()
      for (let left = elapsed; left > 1e-9; left -= SPRING_STEP) {
        const next = springStep(
          { position, velocity },
          dest,
          Math.min(SPRING_STEP, left),
          {
            omega: SPRING_OMEGA,
            damping: SPRING_DAMPING,
            maxSpeed: SPRING_MAX_SPEED,
          },
        )
        position = next.position
        velocity = next.velocity
      }
      // 빠르게 오다 벽 끝에 닿으면(흐르던 속도를 이어받았을 때) 넘어가지 않고 거기서 섭니다
      if (position < 0 || position > max) {
        position = clamp(position, 0, max)
        velocity = 0
      }
      if (
        Math.abs(dest - position) * pitch < REST_PX &&
        Math.abs(velocity) * pitch < REST_SPEED_PX
      ) {
        return finish()
      }
    }

    if (frameMs > 0) speed = (position - before) / frameMs
    apply()
    read().onMove?.(position)
    frame = requestAnimationFrame(tick)
  }

  const run = () => {
    if (frame) return
    lastFrame = performance.now()
    read().onMoveStart()
    frame = requestAnimationFrame(tick)
  }

  const go = (start: number, instant = false) => {
    const { max, stops } = read()
    // 막힌 자리(이름표 벽 기둥이 창 경계에 잘리는 칸)면 가던 쪽의 다음 멈출 자리로 갑니다
    const to = nearStop(
      stops,
      clamp(Math.round(start), 0, max),
      Math.sign(start - position) || 1,
    )
    if (instant || prefersReducedMotion()) {
      dest = to
      return finish()
    }
    if (mode === 'rest' && position === to) return
    // 이미 그 칸으로 가는 중이면 흐르던 그대로 둡니다 — 다시 출발하면 속도가 흐트러집니다
    if ((mode === 'tween' || mode === 'spring') && dest === to) return

    const moving = currentSpeed()
    const distance = to - position
    duration = clamp(
      GLIDE_BASE_MS + GLIDE_PER_SLOT_MS * Math.sqrt(Math.abs(distance)),
      GLIDE_MIN_MS,
      GLIDE_MAX_MS,
    )
    /*
     * 움직이던 중이면 그 속도를 이어받습니다(glideCarry). 휠로 칸에 붙던 중(용수철)이면 그
     * 속도입니다. 같은 쪽이면 옮기는 거리의 GLIDE_CARRY_LIMIT 배까지(지나쳤다 돌아오지 않게),
     * 반대쪽이면 한 칸 이상은 이어받아 뚝 서지 않고 잠깐 밀렸다 돌아서게 합니다.
     */
    const limit =
      GLIDE_CARRY_LIMIT *
      (Math.sign(moving) === Math.sign(distance)
        ? Math.abs(distance)
        : Math.max(1, Math.abs(distance)))
    carry = mode === 'rest' ? 0 : clamp(moving * duration, -limit, limit)
    dest = to
    mode = 'tween'
    from = position
    startedAt = performance.now()
    run()
  }

  return {
    apply,
    go,

    rebase(offset: number) {
      if (!offset) return
      position += offset
      dest += offset
      from += offset
      if (drag) drag.from += offset
      apply()
    },

    configure(next: Options) {
      options = next
    },

    destination: () => (mode === 'drag' ? Math.round(position) : dest),

    /** 멈출 자리가 바뀌어(창 크기) 향하던 칸이 막힌 자리가 되면 가던 쪽의 옆 멈출 자리로 옮깁니다 */
    realign() {
      const { stops } = read()
      if (mode === 'drag' || stops.includes(dest)) return
      const to = nearStop(stops, dest, Math.sign(dest - position) || 1)
      if (mode === 'spring') dest = to
      else go(to, mode === 'rest')
    },

    wheel(event: WheelEvent) {
      // 두 손가락 확대(ctrl + 휠)는 브라우저에 맡깁니다
      if (event.ctrlKey) return
      const { pitch, stops, clear, pageScrollAtEnds } = read()
      // 트랙패드로 좌우로 밀어도 같은 방향으로 흐릅니다. 값을 deltaMode 보다 먼저 읽어야
      // 파이어폭스가 줄 단위가 아니라 px 로 줍니다
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      if (!delta) return
      // 휠로 흘리면 가만히 있는 커서 밑으로 병이 지나갑니다. 마우스를 다시 움직일 때까지 커서 밑 병을 키우지 않습니다
      const target = event.currentTarget
      if (target instanceof Element && target.hasAttribute('data-pointer')) {
        target.removeAttribute('data-pointer')
      }
      // 쌓는 배치: 벽 끝에 서 있는데 그 너머로 굴리면 페이지가 이어서 스크롤되게 둡니다
      if (
        pageScrollAtEnds &&
        mode === 'rest' &&
        wheelStop(
          stops,
          { position, dest, moving: false },
          delta > 0 ? 1 : -1,
        ) === dest
      ) {
        return
      }
      event.preventDefault()

      const counted = meterWheel(meter, {
        delta,
        deltaMode: event.deltaMode,
        time: event.timeStamp,
        pitch,
      })
      meter = counted.meter
      // 손가락으로 잡고 있으면 손가락을 따릅니다
      if (counted.step === 0 || mode === 'drag') return

      const next = wheelStop(
        stops,
        { position, dest, moving: mode !== 'rest' },
        counted.step,
      )
      // 벽 끝에서 더 굴리면 아무 일도 없습니다 — 움직이기 시작했다고 알리지도 않습니다
      if (next === dest) return
      // 지금 자리보다 가리지 않는 칸 수 넘게 앞서 쌓지 않습니다
      if (Math.abs(next - position) > clear) return

      dest = next
      if (prefersReducedMotion()) return finish()
      // 옮기던 중이면 흐르던 속도 그대로 용수철이 이어받습니다 — 뚝 섰다가 다시 출발하지 않습니다
      if (mode === 'tween') velocity = speed * 1000
      mode = 'spring'
      run()
    },

    pointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return
      swallowClick = false
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        from: position,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        moved: false,
      }
    },

    pointerMove(event: PointerEvent) {
      // 마우스를 실제로 움직였습니다 — 이제 커서 밑 병을 키워도 됩니다(휠이 떼어 둔 data-pointer)
      const target = event.currentTarget
      if (
        event.pointerType === 'mouse' &&
        target instanceof Element &&
        !target.hasAttribute('data-pointer')
      ) {
        target.setAttribute('data-pointer', '')
      }
      if (!drag || event.pointerId !== drag.id) return
      const { pitch, max } = read()

      if (!drag.moved) {
        if (Math.abs(event.clientX - drag.startX) < DRAG_SLOP) return
        // 여기서부터 끌기입니다. 흐르던 중이면 손가락이 그 자리에서 잡습니다
        drag.moved = true
        drag.startX = event.clientX
        drag.from = position
        cancelAnimationFrame(frame)
        frame = 0
        mode = 'drag'
        const element = event.currentTarget
        if (element instanceof Element)
          element.setPointerCapture(event.pointerId)
        read().onMoveStart()
      }

      position = clamp(
        drag.from - (event.clientX - drag.startX) / pitch,
        0,
        max,
      )
      const elapsed = event.timeStamp - drag.lastTime
      if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed
      // 손가락이 오른쪽으로 가면(velocity > 0) 벽은 앞 칸 쪽으로 갑니다
      speed = -drag.velocity / pitch
      drag.lastX = event.clientX
      drag.lastTime = event.timeStamp
      apply()
      read().onMove?.(position)
    },

    pointerUp(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.id) return
      const { moved, velocity: fingerSpeed, from: grabbed } = drag
      drag = null
      if (!moved) return

      swallowClick = true
      const { pitch, max, stops } = read()
      // 손가락이 왼쪽으로 튕기면(속도 < 0) 벽은 오른쪽 병으로 더 흘러갑니다
      const projected = position - (fingerSpeed * FLING_MS) / pitch
      const direction = Math.sign(-fingerSpeed) || Math.sign(position - grabbed)
      dest = nearStop(
        stops,
        snapStart(clamp(projected, 0, max), direction, max),
        direction || 1,
      )
      // 뗀 속도 그대로 용수철이 이어받아 그 칸에 붙입니다
      velocity = (-fingerSpeed * 1000) / pitch
      mode = 'spring'
      // 끌기를 시작할 때 onMoveStart 를 이미 불렀으니 run() 을 거치지 않습니다
      lastFrame = performance.now()
      frame = requestAnimationFrame(tick)
    },

    click(event: MouseEvent) {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    },

    dispose() {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
