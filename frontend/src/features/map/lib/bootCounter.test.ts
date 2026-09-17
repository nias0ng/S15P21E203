import { describe, expect, it } from 'vitest'

import {
  COUNT_OVER,
  COUNT_STEP_MS,
  countBreath,
  countRest,
  odometerTracks,
  planCount,
  rollCount,
  sampleAt,
} from './bootCounter'
import {
  BOOT_CEILING,
  BOOT_FIRST_MIN_MS,
  applyBootEvent,
  bootDisplayTarget,
  createBootState,
  type SceneBootState,
} from './bootProgress'

const ready = (state: SceneBootState, at: number): SceneBootState =>
  applyBootEvent(state, { stage: 'boat', ok: true }, at)

const isMonotone = (values: number[]): boolean =>
  values.every((value, i) => value >= (values[i - 1] ?? value))

describe('countBreath', () => {
  it('오르는 속도를 0.5 ~ 1.5 배 안에서 흔듭니다', () => {
    for (let t = 0; t < 6000; t += 7) {
      expect(countBreath(t)).toBeGreaterThanOrEqual(0.5)
      expect(countBreath(t)).toBeLessThanOrEqual(1.5)
    }
  })
})

describe('planCount', () => {
  it('뒤로 가지 않고, 다 뜨기 전에는 99 를 넘지 않습니다', () => {
    const values = planCount(createBootState(0, true), 0, 0, 10_000)
    expect(isMonotone(values)).toBe(true)
    expect(Math.max(...values)).toBeLessThanOrEqual(BOOT_CEILING)
  })

  it('다 떴으면 최소 표시 시간이 지난 뒤 100 에 닿습니다', () => {
    const values = planCount(
      ready(createBootState(0, true), 800),
      0,
      0,
      BOOT_FIRST_MIN_MS + 2000,
    )
    expect(values.at(-1)).toBe(100)
    const hitAt = values.findIndex((value) => value >= 100) * COUNT_STEP_MS
    expect(hitAt).toBeGreaterThanOrEqual(BOOT_FIRST_MIN_MS)
  })

  it('다 떴으면 끝에서 느려지지 않고 100 까지 감아올립니다', () => {
    // 최소 표시 시간이 지난 순간 90 이었다면 0.3초 안에 100
    const state = ready(createBootState(0, true), 800)
    const values = planCount(state, 90, BOOT_FIRST_MIN_MS, 1000)
    expect(values[Math.round(300 / COUNT_STEP_MS)]).toBe(100)
  })

  it('목표가 한참 앞서 있어도 한 번에 뛰지 않고 감아올립니다', () => {
    // 번들이 늦게 와 1.8초에야 숫자를 시작 — 목표는 이미 높습니다
    const state = ready(createBootState(1800, true), 1800)
    const values = planCount(state, 0, 1800, 2000)
    const jumps = values.slice(1).map((value, i) => value - (values[i] ?? 0))
    expect(Math.max(...jumps)).toBeLessThanOrEqual((90 / 1000) * COUNT_STEP_MS)
    expect(values[Math.round(300 / COUNT_STEP_MS)]).toBeLessThan(25)
    // 2초 안에 절반 너머까지 따라붙습니다 — 머뭇거림(countRest)이 생기면서 예전(70)보다 느려졌습니다.
    // 남은 몫은 다 떴을 때 100 으로 감아올리며 메웁니다(SPEED_FINISH)
    expect(values.at(-1)).toBeGreaterThan(50)
  })

  it('엔진 신호가 없어도 1초마다 적어도 1 씩은 오릅니다', () => {
    const values = planCount(createBootState(0, true), 0, 0, 3000)
    const window = Math.round(1000 / COUNT_STEP_MS)
    for (let i = window; i < values.length; i += window) {
      expect(
        (values[i] ?? 0) - (values[i - window] ?? 0),
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('실제 진행이 멈춰 있으면 목표보다 조금 앞에서 기다립니다', () => {
    // 첫 장 뒤 배 GLB 가 오지 않음(크기도 모름) — 5초가 지나도 99 까지 달아나지 않습니다
    const state = applyBootEvent(
      createBootState(0, true),
      { stage: 'frame' },
      500,
    )
    const values = planCount(state, 0, 0, 5000)
    const end = values.at(-1) ?? 0
    expect(end).toBeLessThan(BOOT_CEILING)
    expect(end).toBeLessThanOrEqual(
      bootDisplayTarget(state, 5000) + COUNT_OVER + 1e-9,
    )
  })
})

describe('rollCount', () => {
  it('느리게 오를 땐 대부분 정수에서 쉬고 칸의 끝에서 굴러갑니다', () => {
    // 1초에 1 씩 — 한 칸 1000ms 가운데 끝 220ms 만 굴러갑니다
    const values = Array.from(
      { length: 250 },
      (_, i) => 10 + (i * COUNT_STEP_MS) / 1000,
    )
    const rolled = rollCount(values, COUNT_STEP_MS, 10)
    expect(isMonotone(rolled)).toBe(true)
    const resting = rolled.filter((q) => Number.isInteger(q)).length
    expect(resting / rolled.length).toBeGreaterThan(0.6)
    expect(Math.floor(rolled.at(-1) ?? 0)).toBe(13)
  })

  it('빠르게 오를 땐 쉬지 않고 계수기 값을 그대로 따라 돕니다', () => {
    const values = Array.from(
      { length: 60 },
      (_, i) => i * COUNT_STEP_MS * 0.05,
    )
    const rolled = rollCount(values)
    rolled.forEach((q, i) => expect(q).toBeCloseTo(values[i] ?? NaN, 6))
  })

  it('속도가 떨어져도 굴러가던 칸은 마저 굴러가고 뒤로 가지 않습니다', () => {
    const rolled = rollCount([20.9, 20.9, 20.9, 20.9], COUNT_STEP_MS, 20.5)
    expect(isMonotone(rolled)).toBe(true)
    expect(rolled.at(-1)).toBeGreaterThan(20.5)
    expect(rolled.at(-1)).toBeLessThanOrEqual(21)
  })
})

describe('sampleAt', () => {
  it('사이는 직선으로 잇고, 범위 밖은 양 끝 값입니다', () => {
    const values = [0, 10, 20]
    expect(sampleAt(values, 100, 100 + COUNT_STEP_MS / 2)).toBe(5)
    expect(sampleAt(values, 100, 0)).toBe(0)
    expect(sampleAt(values, 100, 10_000)).toBe(20)
  })
})

describe('odometerTracks', () => {
  it('9 → 10 에서 일의 자리는 같은 0 칸으로 옮기고, 십의 자리가 굴러 들어오며 앞 빈칸이 하나 줍니다', () => {
    const { ones, tens, hundreds, lead } = odometerTracks([
      8, 8.5, 9, 9.5, 10, 10.5,
    ])
    const wrap = ones.findIndex((key) => key.value === 11)
    expect(ones[wrap]?.offset).toBeCloseTo(0.8, 9)
    expect(ones[wrap + 1]).toEqual({ offset: ones[wrap]?.offset, value: 1 })
    expect(ones.at(-1)?.value).toBeCloseTo(1.5, 9)
    expect(tens.map((key) => key.value)).toEqual([0, 0, 0.5, 1, 1])
    expect(hundreds.map((key) => key.value)).toEqual([0, 0])
    expect(lead[0]?.value).toBe(2)
    expect(lead.at(-1)?.value).toBe(1)
  })

  it('100 에서 백의 자리가 들어오고 앞 빈칸이 없어집니다', () => {
    const { ones, tens, hundreds, lead } = odometerTracks([98, 99, 99.5, 100])
    expect(ones.at(-1)?.value).toBe(1)
    expect(tens.at(-1)?.value).toBe(10)
    expect(hundreds.at(-1)?.value).toBe(1)
    expect(lead.at(-1)?.value).toBe(0)
  })

  it('실제 계획으로 만든 키프레임은 offset 이 0 에서 1 까지 줄어들지 않습니다', () => {
    const state = ready(createBootState(0, true), 1200)
    const rolled = rollCount(planCount(state, 0, 0, 4000))
    const tracks = odometerTracks(rolled)
    for (const keys of [
      tracks.ones,
      tracks.tens,
      tracks.hundreds,
      tracks.lead,
    ]) {
      expect(keys[0]?.offset).toBe(0)
      expect(keys.at(-1)?.offset).toBe(1)
      expect(isMonotone(keys.map((key) => key.offset))).toBe(true)
    }
    expect(
      Math.max(...tracks.ones.map((key) => key.value)),
    ).toBeLessThanOrEqual(11)
  })
})

describe('countRest (머뭇거림)', () => {
  const sample = (from: number, to: number, step = 10): number[] => {
    const out: number[] = []
    for (let t = from; t < to; t += step) out.push(countRest(t))
    return out
  }

  it('보통은 1 이고, 머무는 동안만 거의 0 까지 떨어집니다', () => {
    const values = sample(0, 6000)
    expect(Math.max(...values)).toBeCloseTo(1, 6)
    expect(Math.min(...values)).toBeGreaterThan(0)
    expect(Math.min(...values)).toBeLessThan(0.05)
  })

  it('5초 동안 서너 번, 한 번에 0.3초 넘게 머뭅니다 — 한 번도 안 쉬면 만들어 낸 티가 납니다', () => {
    const values = sample(0, 5000)
    let spells = 0
    let resting = false
    for (const value of values) {
      if (value < 0.2 && !resting) spells += 1
      resting = value < 0.2
    }
    expect(spells).toBeGreaterThanOrEqual(3)
    expect(spells).toBeLessThanOrEqual(5)
    const still = values.filter((value) => value < 0.2).length * 10
    expect(still / spells).toBeGreaterThan(300)
  })

  it('같은 시각이면 늘 같은 값입니다 — 계획을 다시 계산해도 결이 이어집니다', () => {
    expect(countRest(2345)).toBe(countRest(2345))
    expect(countRest(2345.6)).toBe(countRest(2345.6))
  })
})

describe('머뭇거림과 계수기', () => {
  it('머무는 동안에는 숫자가 거의 서 있다가, 지나면 따라잡습니다', () => {
    const state = createBootState(0, true)
    // 3초 동안의 흐름에서 가장 느린 0.3초와 가장 빠른 0.3초를 견줍니다
    const values = planCount(state, 0, 0, 3000)
    const window = Math.round(300 / COUNT_STEP_MS)
    const rates: number[] = []
    for (let i = 0; i + window < values.length; i += 1) {
      rates.push((values[i + window] ?? 0) - (values[i] ?? 0))
    }
    expect(Math.min(...rates)).toBeLessThan(1.5)
    expect(Math.max(...rates)).toBeGreaterThan(Math.min(...rates) * 4)
  })

  it('100 으로 감아올릴 때는 머뭇거리지 않습니다', () => {
    // 다 떴고 최소 표시 시간도 지난 뒤 — 머무는 때와 겹쳐도 0.3초 안에 100 입니다
    const state = ready(createBootState(0, true), 800)
    for (const from of [BOOT_FIRST_MIN_MS, BOOT_FIRST_MIN_MS + 600]) {
      const values = planCount(state, 90, from, 1000)
      expect(values[Math.round(300 / COUNT_STEP_MS)]).toBe(100)
    }
  })
})
