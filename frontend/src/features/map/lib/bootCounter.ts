/**
 * 로딩 커튼의 퍼센트 숫자 — 느슨하게 따라가는 계수기와, 자리마다 굴러가는 숫자(주행거리계)의 계산입니다.
 * 순수 함수입니다 (React · DOM 을 모릅니다).
 *
 * 사용자 (2026-09-17) : *"너무 숫자가 멈추니까 딱딱해 보이긴함 … 퍼센트도 완전히 일치보단 느슨하게
 *   해당 라인에서 멈추기 보단 약간의 연출이 있으면 답답하지 않을듯"*
 *
 * ① 계수기 — 목표(`bootDisplayTarget`)를 따라갑니다. 목표보다 아래면 최소 속도로라도 오르고,
 *    목표에 닿아도 조금(COUNT_OVER) 더 기어가며, 속도는 숨 쉬듯 빨라졌다 느려집니다(countBreath).
 *    1.1초마다 한 번은 거의 서다시피 머뭇거렸다 따라잡습니다(countRest) — 한 번도 안 쉬고 오르면 만들어 낸
 *    티가 나서입니다. 최대 속도가 있어 한 번에 뛰지 않고, 100 으로 감아올릴 때는 머뭇거리지 않습니다.
 * ② 굴림 — 느리게 오를 땐 정수에서 쉬다가 다음 숫자로 굴러가고, 빠르게 오를 땐 쉬지 않고 이어서 돕니다.
 * ③ 미리 계산 — 엔진이 뜨는 동안 메인 스레드가 1~3초 막힙니다(엔진 iframe 이 같은 스레드를 씁니다).
 *    그동안 자바스크립트는 숫자를 못 바꾸므로, 앞으로 몇 초의 흐름을 한 번에 계산해 Web Animations
 *    키프레임으로 넘깁니다. 합성 스레드는 막히지 않아 그동안에도 숫자가 굴러갑니다.
 *    메인 스레드가 돌아오면 지금 보이는 값에서 다시 계산합니다 (SceneBootCurtain).
 */
import {
  BOOT_CEILING,
  bootDisplayTarget,
  isBootFinishing,
  type SceneBootState,
} from './bootProgress'

/** 미리 계산하는 간격 · 길이. 메인 스레드가 이보다 오래 막히면 그 끝에서 숫자가 섭니다 */
export const COUNT_STEP_MS = 16
export const COUNT_HORIZON_MS = 4000
/** 목표에 닿은 뒤에도 이만큼(퍼센트 포인트) 더 기어갑니다 — 99 는 넘지 않습니다 */
export const COUNT_OVER = 6

/** 목표와의 차이를 이 시간에 좁히려는 속도로 오릅니다 */
const FOLLOW_MS = 400
/** 속도 — 퍼센트 포인트 / ms */
const SPEED_MIN = 3 / 1000
const SPEED_MAX = 48 / 1000
/**
 * 다 떴을 때 100 까지 마지막으로 감아올리는 속도 — 아래 한도가 높습니다.
 * 목표와의 차이에 비례만 시키면 99 · 100 앞에서 느려져 "줄에서 서는" 것으로 보였습니다(첫 판 실측 92 → 100 에 1.2초)
 */
const SPEED_FINISH_MIN = 40 / 1000
const SPEED_FINISH = 90 / 1000
/**
 * 목표에 닿은 뒤 기어가는 속도 — 배 모델을 받는 동안처럼 실제 진행이 한동안 안 움직여도 숫자가 서 보이지 않게
 * 0.3초에 하나 안팎은 굴러갑니다 (1.2 였을 땐 앱 안 재진입에서 57 → 59 가 0.5초 걸려 선 것처럼 보였습니다)
 */
const SPEED_CREEP = 3.5 / 1000
/** 한 칸(숫자 하나) 굴러가는 시간 */
const ROLL_MS = 220

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const easeInOutCubic = (u: number): number =>
  u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2

/** 숨 — 오르는 속도를 0.5 ~ 1.5 배로 흔듭니다. 시각의 함수라 다시 계산해도 같은 결이 이어집니다 */
export function countBreath(t: number): number {
  return (
    1 +
    0.32 * Math.sin((2 * Math.PI * t) / 1150 + 0.6) +
    0.18 * Math.sin((2 * Math.PI * t) / 470 + 2.3)
  )
}

/**
 * 머뭇거림 — 속도를 잠깐 거의 0 까지 떨어뜨렸다 놓습니다 (1 이면 그대로, REST_DEPTH 면 거의 섭니다).
 *
 * 사용자 (2026-09-18) : *"퍼센트가 지금 한번도 끊김없이 가는것같은데 이건 약간 너무 억지일 수 있으니"* —
 * 한 번도 안 쉬고 오르면 만들어 낸 티가 납니다. 진짜 로딩처럼 가끔 머뭇거렸다 따라잡게 합니다.
 *
 * 머무는 자리는 구간마다 정해진 난수라 **같은 시각이면 늘 같은 값**입니다 — 계획을 다시 계산해도 결이 이어집니다
 * (countBreath 와 같은 규칙). 100 으로 감아올릴 때는 부르지 않습니다 — 마지막은 그대로 둡니다.
 *
 * 숫자가 실제로 서는 것은 굴림(rollCount)이 맡습니다 : 속도가 느려지면 한 칸을 다 굴리지 못해
 * 정수에서 쉬었다가 ease(inOutCubic)로 다음 숫자로 굴러갑니다.
 */
/** 이 간격마다 한 번 머뭇거립니다 */
const REST_EVERY_MS = 1200
/** 머뭇거리는 시간 — 가운데 REST_RAMP 를 뺀 만큼은 거의 서 있습니다 */
const REST_MS = 620
/** 머무는 동안의 속도 몫 (0.03 = 3%) */
const REST_DEPTH = 0.03
/** 들어가고 나오는 몫 — 딱 끊으면 숫자가 툭 섭니다 */
const REST_RAMP = 0.2

/** 0 ~ 1 — 자리마다 정해진 난수 (같은 번호면 늘 같은 값) */
const hash01 = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function countRest(t: number): number {
  const period = Math.floor(t / REST_EVERY_MS)
  const at = period * REST_EVERY_MS + hash01(period) * (REST_EVERY_MS - REST_MS)
  const u = (t - at) / REST_MS
  if (u <= 0 || u >= 1) return 1
  // 들어감 → 머묾 → 나옴. 가운데가 평평해야 숫자가 한 칸에 **머물러 보입니다**(0.4초 안팎) —
  // 사인 한 번으로 오목하게만 만들면 가장 느린 순간이 찰나라 200ms 밖에 안 서 보였습니다(실측)
  const dip =
    u < REST_RAMP
      ? (1 - Math.cos((Math.PI * u) / REST_RAMP)) / 2
      : u > 1 - REST_RAMP
        ? (1 + Math.cos((Math.PI * (u - (1 - REST_RAMP))) / REST_RAMP)) / 2
        : 1
  return 1 - (1 - REST_DEPTH) * dip
}

/** 계수기 한 걸음 — 시각 `t` 에 `x` 였으면 `dt` 뒤의 값. 뒤로 가지 않습니다 */
export function stepCount(
  x: number,
  state: SceneBootState,
  t: number,
  dt: number,
): number {
  const finishing = isBootFinishing(state, t)
  const goal = bootDisplayTarget(state, t)
  const breath = countBreath(t)
  const pace =
    goal > x
      ? Math.min(
          Math.max(
            ((goal - x) / FOLLOW_MS) * breath,
            finishing ? SPEED_FINISH_MIN : SPEED_MIN,
          ),
          finishing ? SPEED_FINISH : SPEED_MAX,
        )
      : SPEED_CREEP * breath
  // 머뭇거림은 **가장 느린 속도(SPEED_MIN)에도** 걸립니다 — 안 그러면 바닥 속도가 받쳐 줘 한 번도 안 섭니다.
  // 100 으로 감아올릴 때(finishing)는 건드리지 않습니다 — 끝맺음은 그대로입니다
  const speed = finishing ? pace : pace * countRest(t)
  const cap = finishing ? 100 : Math.min(BOOT_CEILING, goal + COUNT_OVER)
  return Math.max(x, Math.min(cap, x + speed * dt))
}

/** `from` 부터 `horizon` 동안 `step` 마다의 계수기 값 — 첫 값은 `x0` 입니다 */
export function planCount(
  state: SceneBootState,
  x0: number,
  from: number,
  horizon = COUNT_HORIZON_MS,
  step = COUNT_STEP_MS,
): number[] {
  const steps = Math.max(1, Math.round(horizon / step))
  const values = [x0]
  let x = x0
  for (let i = 0; i < steps; i++) {
    x = stepCount(x, state, from + i * step, step)
    values.push(x)
  }
  return values
}

/** 정수에 아주 가까우면 정수로 봅니다 — 부동소수 오차로 없는 굴림이 생기지 않게 */
const wholeOf = (value: number): number => Math.floor(value + 1e-9)

/**
 * 계수기 값 → 화면에 굴릴 위치. 한 칸을 ROLL_MS 에 굴러갑니다 — 느리면 정수에서 쉬다가 칸의 끝자락에서
 * 굴러가고, 한 칸이 ROLL_MS 보다 빨리 지나가면 쉬지 않고 이어서 돕니다. 뒤로 가지 않고, 굴러가던 칸은
 * (속도가 떨어져도) 멈추지 않고 마저 굴러갑니다. `start` 는 앞 계획에서 지금 보이던 위치입니다.
 */
export function rollCount(
  values: number[],
  step = COUNT_STEP_MS,
  start = 0,
): number[] {
  const last = values.length - 1
  const rolled: number[] = []
  let shown = start
  values.forEach((value, i) => {
    const a = Math.max(0, i - 1)
    const b = Math.min(last, i + 1)
    const speed =
      b > a
        ? ((values[b] ?? value) - (values[a] ?? value)) / ((b - a) * step)
        : 0
    // 한 칸 가운데 굴러가는 몫 — 빠를수록 커지고, 1 이면 칸 전체를 굴러갑니다
    const share = Math.min(1, Math.max(0, speed) * ROLL_MS)
    const whole = wholeOf(value)
    const u = share > 0 ? clamp01((value - whole - (1 - share)) / share) : 0
    // 이어 돌 때(share → 1)는 칸마다 멈칫하지 않게 직선에 가깝게 굴립니다
    const eased = easeInOutCubic(u)
    const q = whole + eased + (u - eased) * share * share
    if (q >= shown) {
      shown = q
    } else if (shown - wholeOf(shown) > 1e-6) {
      shown = Math.min(wholeOf(shown) + 1, shown + step / ROLL_MS)
    }
    rolled.push(shown)
  })
  return rolled
}

/** 계획(`from` 부터 `step` 간격)에서 시각 `t` 의 값 — 사이는 직선으로 잇고, 범위 밖은 양 끝 값 */
export function sampleAt(
  values: number[],
  from: number,
  t: number,
  step = COUNT_STEP_MS,
): number {
  const last = values.length - 1
  const pos = (t - from) / step
  if (pos <= 0) return values[0] ?? 0
  if (pos >= last) return values[last] ?? 0
  const i = Math.floor(pos)
  const a = values[i] ?? 0
  const b = values[i + 1] ?? a
  return a + (b - a) * (pos - i)
}

export interface OdometerKey {
  /** 0 ~ 1 — 계획 길이에 대한 몫 */
  offset: number
  value: number
}

/**
 * 자리마다의 키프레임. 값은 **칸 번호**입니다 (SceneBootCurtain 의 숫자 줄과 같은 순서).
 *   ones      0 빈칸 · 1~10 숫자 0~9 · 11 다시 0 — 9 → 0 은 11 까지 굴러간 순간 1 로 옮깁니다(같은 글자라 안 보입니다)
 *   tens      0 빈칸 · 1~9 · 10 은 100 의 0
 *   hundreds  0 빈칸 · 1
 *   lead      숫자 줄을 왼쪽으로 미는 칸 수 = 안 쓰는 앞자리(빈칸) 수. 2 → 1(10 부터) → 0(100)
 * 앞자리는 일의 자리가 9 → 0 으로 굴러가는 동안 같이 굴러 들어오고, 그만큼 숫자 줄이 오른쪽으로 밀립니다.
 */
export interface OdometerTracks {
  ones: OdometerKey[]
  tens: OdometerKey[]
  hundreds: OdometerKey[]
  lead: OdometerKey[]
}

/** 같은 값이 셋 이상 이어지면(쉬는 동안) 가운데 키프레임을 뺍니다 */
function squeeze(keys: OdometerKey[]): OdometerKey[] {
  return keys.filter((key, i) => {
    const prev = keys[i - 1]
    const next = keys[i + 1]
    return (
      !prev || !next || prev.value !== key.value || next.value !== key.value
    )
  })
}

/** 굴림 위치들(같은 간격) → 자리마다의 키프레임 */
export function odometerTracks(rolled: number[]): OdometerTracks {
  const last = rolled.length - 1
  const ones: OdometerKey[] = []
  const tens: OdometerKey[] = []
  const hundreds: OdometerKey[] = []
  const lead: OdometerKey[] = []
  let prev: number | undefined
  rolled.forEach((q, i) => {
    const offset = last > 0 ? i / last : 0
    const decade = Math.floor(q / 10)
    if (prev !== undefined && decade > Math.floor(prev / 10)) {
      const at = (i - 1 + (decade * 10 - prev) / (q - prev)) / last
      ones.push({ offset: at, value: 11 }, { offset: at, value: 1 })
    }
    const unit = q - decade * 10
    ones.push({ offset, value: 1 + unit })
    tens.push({ offset, value: decade + clamp01(unit - 9) })
    hundreds.push({ offset, value: clamp01(q - 99) })
    lead.push({ offset, value: 2 - clamp01(q - 9) - clamp01(q - 99) })
    prev = q
  })
  return {
    ones: squeeze(ones),
    tens: squeeze(tens),
    hundreds: squeeze(hundreds),
    lead: squeeze(lead),
  }
}
