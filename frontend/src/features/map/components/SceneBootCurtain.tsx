import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import {
  COUNT_HORIZON_MS,
  COUNT_STEP_MS,
  odometerTracks,
  planCount,
  rollCount,
  sampleAt,
  type OdometerKey,
} from '../lib/bootCounter'
import { type SceneBootState } from '../lib/bootProgress'
import {
  WORDMARK_BOX,
  WORDMARK_INK,
  WORDMARK_INK_LAG,
  WORDMARK_PARTS,
  WORDMARK_VIEWBOX,
  wordmarkDrawnAt,
  wordmarkProgress,
  wordmarkTrim,
} from '../lib/bootWordmark'

/** 100% 를 이만큼 보여 준 뒤 걷습니다 */
const HOLD_MS = 150
/** 걷히는 시간 — scene-boot.css · index.html #boot 의 transition(opacity · 원 transform) 과 같은 값입니다 */
const LEAVE_MS = 1400
/** 퍼센트 글꼴(Noto Serif KR 900)이 이만큼 안 오면 폴백 글꼴로 드러냅니다 */
const FONT_WAIT_MS = 600
/** 퍼센트가 드러나는 가장 이른 때 — 대 원이 터지는 순간(커튼 시계 · scene-boot.css 의 --burst-at) */
const REVEAL_AT_MS = 450
/** "0%" 가 아래에서 굴러 들어오는 시간 · % 가 뒤따르는 틈 */
const REVEAL_MS = 560
const REVEAL_STAGGER_MS = 80
const REVEAL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/**
 * 앞 빈칸을 미는 몫 — 1 이면 보이는 숫자가 칸 왼쪽 끝에, **0.5 면 한가운데**에 섭니다.
 * 퍼센트가 글자 아래 가운데로 오면서 0.5 가 되었습니다 (2026-09-18).
 */
const LEAD_PULL = 0.5
/** 다시 계산 — 엔진 신호로 상태가 바뀌었으면 이 간격마다, 아니면 계획이 이만큼 남았을 때 */
const REPLAN_EVERY_MS = 220
const REPLAN_LEFT_MS = 1500
/** 퍼센트 글꼴 — index.html 의 &text= 링크(숫자 · % 만) */
const COUNT_FONT = { family: 'Noto Serif KR', weight: '900' }

/**
 * '향해' 글자 — 마스크(중앙패스)가 자라 아웃라인을 드러냅니다. 대 원이 터져 번지기 시작한 직후에 그립니다
 * (사용자 2026-09-18 : *"중간에 로딩중 실제 끊김이있다면 끊겨도댐"*).
 *
 * `stroke-dashoffset` 은 메인 스레드가 그리므로 엔진이 뜨며 막는 동안에는 획이 멈춥니다. 그래서 시각을 흐른 시간이
 * 아니라 **그려진 장**으로 재고(WORD_STEP_MAX_MS), 막힘이 풀리면 멈춘 자리에서 이어 그립니다 — 시간으로 재면
 * 막힌 1~2초 사이에 글자가 거의 다 그려져 버려 그리는 모습이 통째로 사라집니다.
 */
/** 그리기 시작 — 커튼 시계로, 대 원이 터지는 때(scene-boot.css --burst-at 450ms × 템포 1.5 = 675ms) 바로 뒤 */
const WORD_START_AT_MS = 900
const WORD_DRAW_MS = 2000
const WORD_STROKE_GAP_MS = 50
/** 한 장이 이보다 오래 걸렸으면(엔진이 막았으면) 이만큼만 흐른 것으로 봅니다 */
const WORD_STEP_MAX_MS = 64
/** 커튼은 글자를 다 그릴 때까지 이만큼까지 기다려 줍니다 */
const WORD_WAIT_MAX_MS = 1200
const WORD_MASK_ID = 'scene-boot-word-mask'
/** 마스크의 밝기 = 드러나는 몫 (1 이면 제 색, 0.34 면 옅게 밴 자국) */
const inkTone = (tone: number): string => {
  const level = Math.round(Math.min(1, Math.max(0, tone)) * 255)
  return `rgb(${level} ${level} ${level})`
}

/** 자리마다의 숫자 줄 — 칸 번호는 lib/bootCounter.ts 의 OdometerTracks 와 같은 순서입니다 */
// 줄바꿈 없는 빈칸(nbsp) — 빈칸 칸도 숫자 칸과 같은 높이로 섭니다
const BLANK = String.fromCharCode(0xa0)
const STRIPS = {
  hundreds: [BLANK, '1'],
  tens: [BLANK, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ones: [BLANK, '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  sign: [BLANK, '%'],
}
type StripName = keyof typeof STRIPS
const STRIP_NAMES = Object.keys(STRIPS) as StripName[]

/** 퍼센트 글꼴이 이미 받아져 있는가 — 그러면 기다리지 않고 바로 드러냅니다 (fonts.check 는 글꼴 정의가 아직 없어도 참이라 안 씁니다) */
const countFontLoaded = (fonts: FontFaceSet | undefined): boolean =>
  !!fonts &&
  Array.from(fonts).some(
    (face) =>
      face.family.replace(/["']/g, '') === COUNT_FONT.family &&
      face.weight === COUNT_FONT.weight &&
      face.status === 'loaded',
  )

const translate = (axis: 'X' | 'Y', cells: number, size: number): string =>
  `translate${axis}(${(-cells * size).toFixed(4)}em)`

type KeyframeOptions = {
  /** 계획 길이(ms) */
  planMs: number
  /** 계획 앞에 붙이는 머리(ms) — 머리는 `intro` 칸에서 계획의 첫 칸으로 굴러가고(REVEAL_EASE), `intro` 가 없으면 첫 칸에 서 있습니다 */
  introMs?: number
  intro?: number
  /** 칸을 미끄러지지 않고 키프레임마다 딱 바꿉니다 (모션 줄이기) */
  stepped?: boolean
}

/** 자리 키프레임 → Web Animations 키프레임 */
const keyframes = (
  keys: OdometerKey[],
  axis: 'X' | 'Y',
  size: number,
  { planMs, introMs = 0, intro, stepped = false }: KeyframeOptions,
): Keyframe[] => {
  const total = introMs + planMs
  const body: Keyframe[] = keys.map(({ offset, value }) => ({
    offset: (introMs + offset * planMs) / total,
    transform: translate(axis, value, size),
    ...(stepped && { easing: 'step-end' }),
  }))
  const first = keys[0]
  if (!introMs || !first) return body
  const head: Keyframe = {
    offset: 0,
    transform: translate(axis, intro ?? first.value, size),
    easing: REVEAL_EASE,
  }
  return [head, ...body]
}

type Props = {
  /** 지금 부팅 상태 — 다시 계산할 때마다 읽습니다 (useSceneBoot 의 getState) */
  getState: () => SceneBootState
  /** 걷힘이 끝났습니다 — 호출하는 쪽이 커튼을 내립니다 */
  onDone: () => void
}

/**
 * 3D 향 지도 로딩 커튼 — 흰 바탕 · 짙은 점에서 연막탄처럼 터져 번지는 향 원 세 개(대 · 중 · 소) · 화면 가운데
 * 그려지는 '향해' 글자 · 그 아래 굴러가는 퍼센트.
 *
 * 원의 자리 · 크기 · 색 · 터짐 · 숨과 퍼센트의 칸 · 색은 `scene-boot.css` 에 있습니다. 원은 전부 CSS 애니메이션입니다.
 *
 * 첫 진입에는 `index.html` 의 `#boot`(흰 바탕 · 세 원)가 React 보다 먼저 서서 페이지를 연 순간부터 터지고 있습니다.
 * 이 커튼은 그것을 지우지 않고 투명한 바탕으로 그 위에 퍼센트만 얹고, 걷을 때 같이 걷습니다 — 바꿔 끼우는 순간이
 * 없고, React 가 늦게 떠도 원은 제때 터집니다. 앱 안에서 다시 들어오면(`#boot` 없음) 흰 바탕과 세 원을 여기서 그립니다.
 *
 * 퍼센트는 `lib/bootCounter.ts` 가 앞으로 4초 치 흐름(느슨하게 따라가기 · 굴림)을 미리 계산하고, 여기서 자리마다
 * Web Animations 로 넘깁니다. 엔진이 뜨는 동안 메인 스레드가 1~3초 막혀도 합성 스레드가 숫자를 굴립니다.
 * 엔진 신호로 상태가 바뀌거나 계획이 끝나 가면 지금 보이는 값에서 다시 계산합니다.
 * 100 에 닿으면 잠깐 두고 걷습니다 — 세 원이 더 번지며 옅어지고 그 뒤로 바다가 드러납니다.
 *
 * 화면 전체를 덮는 `fixed` 라 헤더(z-20) · 토스트(z-40) 위에 섭니다.
 */
export function SceneBootCurtain({ getState, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  // 첫 진입이면 index.html 의 정적 커튼(#boot)이 흰 바탕과 세 원을 그리고 있습니다
  const [adopted] = useState(() => document.getElementById('boot') !== null)
  const revisit = !adopted
  const [leaving, setLeaving] = useState(false)
  /** '향해' 글자가 다 그려지는 시각 — 커튼이 그때까지 조금 기다립니다 */
  const wordDone = useRef(0)
  const latestDone = useRef(onDone)
  useEffect(() => {
    latestDone.current = onDone
  })

  // #boot 이어받기 — 걷힐 때까지 그대로 두고, 커튼이 사라지면 지웁니다
  useEffect(() => {
    const stub = adopted ? document.getElementById('boot') : null
    if (!stub) return
    // 이어받았다는 표시 — index.html 의 15초 안전장치가 걷지 않게 합니다
    stub.dataset.adopted = 'true'
    return () => {
      // 개발 모드(StrictMode)는 마운트를 한 번 걷었다 다시 세웁니다 — 커튼이 정말 사라졌을 때만 지웁니다
      window.setTimeout(() => {
        if (!document.querySelector('.scene-boot')) stub.remove()
      }, 0)
    }
  }, [adopted])

  // 퍼센트 — 글꼴 · 터지는 때를 기다려 굴러 들어오고, 미리 계산한 흐름대로 굴러갑니다
  useEffect(() => {
    const el = root.current
    const box = el?.querySelector<HTMLElement>('.scene-boot-count')
    const shift = box?.querySelector<HTMLElement>('.scene-boot-shift')
    const found = STRIP_NAMES.map((name) =>
      box?.querySelector<HTMLElement>(`[data-strip="${name}"]`),
    )
    if (!el || !box || !shift) return
    const [hundreds, tens, ones, sign] = found
    if (!hundreds || !tens || !ones || !sign) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    let alive = true
    let raf = 0
    let leaveTimer = 0
    let fontReady = false
    /** 숫자가 오르기 시작하는 시각 — 굴러 들어온 뒤 */
    let startAt = Infinity
    let finishAt = Infinity
    let plan: {
      from: number
      values: number[]
      rolled: number[]
      state: SceneBootState
    } | null = null
    let running: Animation[] = []
    const revealing: Animation[] = []
    let shownWhole = -1

    // 칸 높이 · 숫자 한 자리 폭 (em) — 글꼴이 바뀌면 달라지므로 쓸 때마다 잽니다
    const measure = () => {
      const font = parseFloat(getComputedStyle(box).fontSize) || 1
      const first = hundreds.parentElement?.getBoundingClientRect()
      const second = tens.parentElement?.getBoundingClientRect()
      if (!first || !second) return { cell: 1.3, digit: 0.6 }
      return {
        cell: first.height / font,
        digit: (second.left - first.left) / font,
      }
    }

    // 계획을 자리마다 넘깁니다. `from` 은 계획이 시작하는 시각, `introMs` 는 그 앞에 붙이는 "0" 굴러 들어오기입니다.
    // ⚠ 한 요소에는 transform 애니메이션을 하나만 둡니다 — 둘이 겹치면 크롬이 합성 스레드로 넘기지 못해, 엔진이 메인
    //   스레드를 막는 동안 그 자리만 섭니다(첫 판 실측 : 굴러 들어오기와 계획이 겹친 일의 자리가 빈칸으로 멈춤)
    const schedule = (from: number, rolled: number[], introMs = 0) => {
      const { cell, digit } = measure()
      const tracks = odometerTracks(rolled)
      const planMs = (rolled.length - 1) * COUNT_STEP_MS
      // 모션 줄이기 — 숫자 칸은 키프레임마다 딱 바꿉니다(step-end). 숫자 줄을 미는 애니메이션(shift)만은 선형으로 둡니다 —
      // 거기에 step-end 를 주면 크롬이 합성 스레드에서 안 돌려, 엔진이 막는 동안 숫자가 한 칸 밀려 보였습니다(09-17 실측)
      const shape: KeyframeOptions = { planMs, introMs }
      const digits: KeyframeOptions = { ...shape, stepped: reduceMotion }
      // fill both — 시작 시각이 이번 장보다 조금 뒤여도(performance.now() 는 장의 시각보다 늦습니다) 첫 칸을 보입니다.
      // forwards 만 두면 옛 계획을 지운 그 한 장에 인라인 자리(앞 빈칸 둘)가 비쳐 숫자가 한 칸 밀려 보였습니다
      const timing: KeyframeAnimationOptions = {
        duration: introMs + planMs,
        fill: 'both',
      }
      const next = [
        ones.animate(
          keyframes(tracks.ones, 'Y', cell, { ...digits, intro: 0 }),
          timing,
        ),
        tens.animate(keyframes(tracks.tens, 'Y', cell, digits), timing),
        hundreds.animate(keyframes(tracks.hundreds, 'Y', cell, digits), timing),
        shift.animate(
          keyframes(tracks.lead, 'X', digit * LEAD_PULL, shape),
          timing,
        ),
      ]
      for (const animation of next) animation.startTime = from - introMs
      // 새 계획이 위에 선 뒤에 옛 계획을 지웁니다 — 사이에 빈 장이 없게
      for (const animation of running) animation.cancel()
      running = next
    }

    const replan = (now: number, introMs = 0) => {
      const x0 = plan ? sampleAt(plan.values, plan.from, now) : 0
      const q0 = plan ? sampleAt(plan.rolled, plan.from, now) : 0
      const state = getState()
      const values = planCount(state, x0, now, COUNT_HORIZON_MS)
      // 모션 줄이기 — 굴리지 않고 정수로 바로 바꿉니다
      const rolled = reduceMotion
        ? values.map((value) => Math.floor(value))
        : rollCount(values, COUNT_STEP_MS, q0)
      plan = { from: now, values, rolled, state }
      schedule(now, rolled, introMs)
      const hit = rolled.findIndex((q) => q >= 100)
      if (hit >= 0) finishAt = now + hit * COUNT_STEP_MS
    }

    // 시각은 performance.now() 입니다 — document.timeline 은 마지막으로 칠한 장의 시각이라 엔진이 메인 스레드를
    // 막은 직후엔 한참 뒤처져 있습니다 (둘 다 같은 원점이라 애니메이션 startTime 에 그대로 씁니다)
    const tick = () => {
      if (!alive) return
      const now = performance.now()
      if (now >= startAt) {
        const due =
          !plan ||
          now - plan.from >= COUNT_HORIZON_MS - REPLAN_LEFT_MS ||
          (getState() !== plan.state && now - plan.from >= REPLAN_EVERY_MS)
        if (due && finishAt === Infinity) replan(now)
        if (plan) {
          const q = sampleAt(plan.rolled, plan.from, now)
          el.style.setProperty('--boot-progress', (q / 100).toFixed(3))
          const whole = Math.floor(q)
          if (whole !== shownWhole) {
            shownWhole = whole
            el.setAttribute('aria-valuenow', String(whole))
          }
        }
        if (now >= finishAt) {
          // 글자를 다 그릴 때까지 조금 기다립니다 — 그리는 중에 커튼이 걷히지 않게
          const wait = Math.min(
            Math.max(0, wordDone.current - now),
            WORD_WAIT_MAX_MS,
          )
          leaveTimer = window.setTimeout(() => setLeaving(true), HOLD_MS + wait)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }

    // 드러내기 — 글꼴이 오면 곧바로 부릅니다. 드러나는 때(대 원이 터지는 순간)가 아직이면 기다리지 않고 **시작 시각이
    // 미래인 애니메이션**으로 넘깁니다 — 타이머로 기다리면 그사이 엔진이 메인 스레드를 막아 한참 늦게 나타났습니다
    // (첫 판 실측 : 앱 안에서 다시 들어올 때 원보다 1.5초 늦게 0% 가 섰습니다)
    const reveal = () => {
      if (!alive || !fontReady || startAt !== Infinity) return
      const now = performance.now()
      // 다시 들어오면 두 배 빠른 시계(scene-boot.css 의 --boot-tempo)
      const revealFrom = Math.max(
        now,
        getState().startedAt + REVEAL_AT_MS * (revisit ? 0.5 : 1),
      )
      const { cell, digit } = measure()
      // 앞자리 두 칸(백 · 십)은 빈칸 — 줄을 그 절반만큼 왼쪽으로 밀어 "0%" 가 가운데에 서게 합니다
      shift.style.transform = translate('X', 2, digit * LEAD_PULL)
      box.classList.add('is-shown')
      if (reduceMotion) {
        ones.style.transform = translate('Y', 1, cell)
        sign.style.transform = translate('Y', 1, cell)
        startAt = revealFrom
        replan(startAt)
        return
      }
      // "0" 은 계획의 머리로 굴러 들어오고(schedule), % 는 조금 뒤따릅니다
      revealing.push(
        sign.animate(
          [
            { transform: translate('Y', 0, cell) },
            { transform: translate('Y', 1, cell) },
          ],
          {
            duration: REVEAL_MS,
            delay: revealFrom - now + REVEAL_STAGGER_MS,
            easing: REVEAL_EASE,
            fill: 'forwards',
          },
        ),
      )
      startAt = revealFrom + REVEAL_MS
      // 첫 계획은 지금 넘깁니다 — 엔진이 곧바로 메인 스레드를 막아도 합성 스레드가 제때 숫자를 굴립니다
      // (첫 판 실측 : 굴러 들어온 뒤에 넘겼더니 막힌 1.1초 동안 0% 에 섰습니다)
      replan(startAt, REVEAL_MS)
    }

    // 글꼴이 이미 받아져 있으면 **이 자리에서 바로** 드러내고 첫 계획을 넘깁니다 — 엔진은 두 장 뒤에 뜨므로(ScentScene)
    // 그 전에 숫자가 합성 스레드로 넘어갑니다
    const markFontReady = () => {
      fontReady = true
      reveal()
    }
    const fontTimer = window.setTimeout(markFontReady, FONT_WAIT_MS)
    // jsdom 에는 document.fonts 가 없습니다
    const fonts: FontFaceSet | undefined = document.fonts
    if (countFontLoaded(fonts)) {
      markFontReady()
    } else if (fonts) {
      // 숫자와 % 만 물어 그 조각만 기다립니다
      fonts
        .load(
          `${COUNT_FONT.weight} 100px "${COUNT_FONT.family}"`,
          '0123456789%',
        )
        .then(markFontReady, markFontReady)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(fontTimer)
      window.clearTimeout(leaveTimer)
      for (const animation of [...running, ...revealing]) animation.cancel()
    }
  }, [getState, revisit])

  // '향해' 글자 — 중앙패스 마스크가 자라 아웃라인을 드러냅니다 (트림 패스 · lib/bootWordmark.ts)
  useEffect(() => {
    const el = root.current
    // 겹(붓 자국) 하나가 획 13개를 다 가지고 있습니다 — 겹마다 따로 모읍니다
    const layers = WORDMARK_INK.map((ink, layer) => ({
      ink,
      paths: Array.from(
        el?.querySelectorAll<SVGPathElement>(`[data-ink="${layer}"]`) ?? [],
      ),
    }))
    const strokes = layers[0]?.paths
    if (!strokes || strokes.length === 0) return
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const tempo = revisit ? 0.5 : 1
    const lengths = Array.from(strokes, (path) => path.getTotalLength())
    // 처음에는 마스크가 하나도 칠해져 있지 않습니다 — 글자가 안 보입니다
    for (const { paths } of layers) {
      paths.forEach((path, stroke) => {
        const length = lengths[stroke] ?? 0
        path.style.strokeDasharray = String(length)
        path.style.strokeDashoffset = reduceMotion ? '0' : String(length)
      })
    }
    if (reduceMotion) {
      wordDone.current = performance.now()
      return
    }

    const steps = wordmarkTrim(lengths, {
      drawMs: WORD_DRAW_MS * tempo,
      strokeGapMs: WORD_STROKE_GAP_MS * tempo,
    })
    // 붓끝이 획 끝에 닿은 뒤에도 뒤엣것이 따라오는 동안은 아직 그리는 중입니다
    const drawMs = wordmarkDrawnAt(steps, WORDMARK_INK_LAG)
    const startAt = getState().startedAt + WORD_START_AT_MS * tempo
    // 그려진 장만큼만 흐르는 시계 — 한 장이 오래 걸렸으면(엔진이 메인 스레드를 막았으면) 그동안은 흐르지 않은
    // 것으로 봅니다. 획은 막힌 동안 서 있다가 멈춘 자리에서 이어 그려집니다. Web Animations 로 넘기면 막힌
    // 사이에도 시계가 흘러 글자가 이미 다 그려진 채로 나타납니다 — 그리는 모습이 통째로 사라집니다
    let drawn = 0
    let last = 0
    let raf = requestAnimationFrame(function step() {
      const now = performance.now()
      if (now >= startAt) {
        if (last) {
          const flowed = Math.min(now - last, WORD_STEP_MAX_MS)
          drawn = Math.min(drawMs, drawn + flowed)
        }
        last = now
        // 겹마다 제 몫만큼 뒤처져 따라옵니다 — 획 머리에 가는 자국이 길게 남습니다
        for (const { ink, paths } of layers) {
          const progress = wordmarkProgress(steps, drawn, ink.lag)
          paths.forEach((path, stroke) => {
            const length = lengths[stroke] ?? 0
            path.style.strokeDashoffset = String(
              length * (1 - (progress[stroke] ?? 0)),
            )
          })
        }
      }
      // 커튼이 얼마나 더 기다려야 하는지 — 막히면 그만큼 뒤로 밀립니다
      wordDone.current = Math.max(now, startAt) + (drawMs - drawn)
      if (drawn >= drawMs) return
      raf = requestAnimationFrame(step)
    })

    return () => cancelAnimationFrame(raf)
  }, [getState, revisit])

  // 걷힘 — transitionend 가 아니라 타이머입니다. 모션 줄이기(전환 0.01ms)에서도 같은 길로 끝납니다
  useEffect(() => {
    if (!leaving) return
    document.getElementById('boot')?.classList.add('is-leaving')
    const timer = window.setTimeout(() => latestDone.current(), LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  return (
    <div
      ref={root}
      role="progressbar"
      aria-label="향 지도를 불러오는 중"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className={cn(
        'scene-boot fixed inset-0 z-100',
        // 흰 바탕은 첫 진입이면 #boot 의 안개, 다시 들어오면 아래 안개가 깝니다
        'bg-transparent',
        revisit && 'is-revisit',
        leaving && 'is-leaving',
      )}
    >
      {/* 흰 안개 — 바탕 한 장 + 가장자리 넉 장. 걷힐 때 가운데부터 트입니다 (scene-boot.css) */}
      {revisit && (
        <>
          <i aria-hidden className="scene-boot-haze" />
          {['t', 'b', 'l', 'r'].map((edge) => (
            <i
              key={edge}
              aria-hidden
              className={`scene-boot-haze-edge scene-boot-haze-${edge}`}
            />
          ))}
        </>
      )}
      {/*
        향 원 세 개 — 대(왼쪽) · 중(오른쪽 위) · 소(오른쪽 아래). 짙고 작은 점이 차례로 연막탄처럼 터져 번지고,
        100% 쯤 화면을 거의 채웁니다. 셋 다 원 모양 마스크 안에서 여러 색이 번집니다 —
        색은 3D 저녁 바다의 비율입니다 — 대(화면 밖까지)는 살구 · 금빛 · 연보라, 중은 연보라, 소는 노을입니다.
        첫 진입에는 index.html 의 #boot 가 그리고 있어서 앱 안에서 다시 들어올 때만 그립니다 (scene-boot.css)
      */}
      {revisit && (
        <Scent size="large">
          <span className="scene-boot-orb scene-boot-orb-mixed">
            <span className="scene-boot-slot scene-boot-slot-peach">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-gold">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-lilac">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-shimmer">
              <i className="scene-boot-wash" />
            </span>
          </span>
        </Scent>
      )}
      {revisit && (
        <Scent size="medium">
          <span className="scene-boot-orb scene-boot-orb-mixed">
            <span className="scene-boot-slot scene-boot-slot-lilac">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-peach">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-shimmer">
              <i className="scene-boot-wash" />
            </span>
          </span>
        </Scent>
      )}
      {revisit && (
        <Scent size="small">
          <span className="scene-boot-orb scene-boot-orb-mixed">
            <span className="scene-boot-slot scene-boot-slot-sunset">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-gold">
              <i className="scene-boot-wash" />
            </span>
            <span className="scene-boot-slot scene-boot-slot-peach">
              <i className="scene-boot-wash" />
            </span>
          </span>
        </Scent>
      )}
      {/*
        '향해' — 보이는 것은 아웃라인(면)이고, 중앙패스를 굵게 칠하는 마스크가 자라며 글자를 드러냅니다(트림 패스).
        viewBox 가 글자 테두리라 SVG 상자가 곧 글자입니다 — 화면 가운데에 폭만 정해 놓습니다 (scene-boot.css · lib/bootWordmark.ts)
      */}
      <svg
        aria-hidden
        className="scene-boot-word"
        viewBox={WORDMARK_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/*
            획마다 마스크 하나 — 중앙패스를 굵게 칠하고, 칠해진 만큼 **그 획의 면만** 드러납니다.
            마스크를 하나로 쓰면 굵은 획을 그릴 때 옆 조각이 먼저 비칩니다 (lib/bootWordmark.ts).
            ⚠ 영역(x · y · width · height)을 글자 상자로 못 박습니다 — userSpaceOnUse 의 기본 영역은 좌표 원점에서
            잰 −10%~120% 라, 글자가 원점에서 떨어져 있으면 통째로 가려집니다
          */}
          {WORDMARK_PARTS.map((part, stroke) => (
            <mask
              key={part.name}
              id={`${WORD_MASK_ID}-${stroke}`}
              maskUnits="userSpaceOnUse"
              x={WORDMARK_BOX.x}
              y={WORDMARK_BOX.y}
              width={WORDMARK_BOX.width}
              height={WORDMARK_BOX.height}
            >
              {WORDMARK_INK.map((ink, layer) => (
                <path
                  key={layer}
                  d={part.stroke}
                  strokeWidth={ink.width}
                  stroke={inkTone(ink.tone)}
                  data-word-stroke=""
                  data-ink={layer}
                />
              ))}
            </mask>
          ))}
        </defs>
        {WORDMARK_PARTS.map((part, stroke) => (
          <path
            key={part.name}
            d={part.outline}
            mask={`url(#${WORD_MASK_ID}-${stroke})`}
          />
        ))}
      </svg>
      {/*
        화면 가운데 — '향해' 글자 바로 아래입니다. 자리 · 크기는 글자 배율(--boot-word-k)에 매여 있어
        scene-boot.css 에 있습니다. 자리마다 숫자 줄이 굴러가고, 앞 빈칸은 반만 밀어 가운데를 잡습니다
      */}
      <p
        aria-hidden
        className="scene-boot-count font-serif font-black tracking-[-0.04em] whitespace-nowrap tabular-nums"
      >
        <span className="scene-boot-shift">
          {STRIP_NAMES.map((name) => (
            <span key={name} className="scene-boot-col">
              <span className="scene-boot-strip" data-strip={name}>
                {STRIPS[name].map((cell, i) => (
                  <span key={i}>{cell}</span>
                ))}
              </span>
            </span>
          ))}
        </span>
      </p>
    </div>
  )
}

/** 원 하나의 겹 — 자리 · 맺힘 · 번짐 · 풀림 (scene-boot.css) */
function Scent({
  size,
  children,
}: {
  size: 'large' | 'medium' | 'small'
  children: ReactNode
}) {
  return (
    <span aria-hidden className={`scene-boot-scent scene-boot-scent-${size}`}>
      <span className="scene-boot-pop">
        <span className="scene-boot-grow">
          <span className="scene-boot-ink">{children}</span>
        </span>
      </span>
    </span>
  )
}
