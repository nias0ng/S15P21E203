import { describe, expect, it } from 'vitest'

import {
  BOOT_BOAT_TIMEOUT_MS,
  BOOT_CEILING,
  BOOT_FIRST_MIN_MS,
  BOOT_FRAME_TIMEOUT_MS,
  BOOT_LEAD,
  BOOT_MOUNT_FLOOR_MS,
  BOOT_REVISIT_MIN_MS,
  applyBootEvent,
  bootCeiling,
  bootDisplayTarget,
  bootTarget,
  createBootState,
  isBootReady,
  parseBootMessage,
  snapshotEvents,
  type SceneBootState,
} from './bootProgress'

const ready = (state: SceneBootState, at: number): SceneBootState =>
  applyBootEvent(state, { stage: 'boat', ok: true }, at)

describe('createBootState', () => {
  it('첫 진입은 항해 시작(0)부터 세고, 최소 표시 시간과 마운트 뒤 여유 중 늦은 쪽까지 보여 줍니다', () => {
    expect(createBootState(500, true)).toMatchObject({
      firstVisit: true,
      startedAt: 0,
      minUntil: BOOT_FIRST_MIN_MS,
    })
    // 번들이 아주 늦게 오면 마운트 + 여유가 더 늦습니다
    const late = BOOT_FIRST_MIN_MS - BOOT_MOUNT_FLOOR_MS + 1000
    expect(createBootState(late, true).minUntil).toBe(
      late + BOOT_MOUNT_FLOOR_MS,
    )
  })

  it('다시 들어왔을 때는 마운트부터 짧게 셉니다', () => {
    expect(createBootState(9000, false)).toMatchObject({
      firstVisit: false,
      startedAt: 9000,
      minUntil: 9000 + BOOT_REVISIT_MIN_MS,
    })
  })
})

describe('applyBootEvent', () => {
  const base = createBootState(0, true)

  it('단계가 끝난 시각을 적고, 같은 단계가 다시 오면 그대로 둡니다', () => {
    const once = applyBootEvent(base, { stage: 'script' }, 300)
    expect(once.doneAt.script).toBe(300)
    expect(applyBootEvent(once, { stage: 'script' }, 900)).toBe(once)
  })

  it('뒤 단계가 오면 놓친 앞 단계도 끝난 것으로 봅니다', () => {
    const state = applyBootEvent(base, { stage: 'frame' }, 700)
    expect(state.doneAt).toEqual({ html: 700, script: 700, frame: 700 })
    expect(state.doneAt.boat).toBeUndefined()
  })

  it('받은 바이트는 뒤로 가지 않고, 전체가 0 이면 크기를 모르는 것으로 둡니다', () => {
    const a = applyBootEvent(
      base,
      { stage: 'boat-bytes', loaded: 4000, total: 0 },
      100,
    )
    expect(a).toMatchObject({ boatLoaded: 4000, boatTotal: null })
    const b = applyBootEvent(
      a,
      { stage: 'boat-bytes', loaded: 1000, total: 8000 },
      200,
    )
    expect(b).toMatchObject({ boatLoaded: 4000, boatTotal: 8000 })
  })

  it('오류는 문구를 남깁니다', () => {
    expect(
      applyBootEvent(base, { stage: 'error', message: 'boom' }, 10).error,
    ).toBe('boom')
  })
})

describe('bootTarget', () => {
  it('시작 직후는 0, 배까지 붙으면 100 입니다', () => {
    const state = createBootState(0, true)
    expect(bootTarget(state, 0)).toBe(0)
    expect(bootTarget(ready(state, 2000), 2000)).toBe(100)
  })

  it('신호가 없어도 시간이 흐르면 조금씩 오르되 단계 가중치의 90% 를 넘지 않습니다', () => {
    const state = createBootState(0, true)
    const early = bootTarget(state, 500)
    const late = bootTarget(state, 60_000)
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    // html 5 + script 15 + frame 25 + bytes 45 = 90 의 90% · boat 는 신호 없이는 0
    expect(late).toBeLessThan(90 * 0.9 + 1)
  })

  it('배 GLB 는 받은 비율 그대로입니다', () => {
    const state = applyBootEvent(
      applyBootEvent(createBootState(0, true), { stage: 'frame' }, 100),
      { stage: 'boat-bytes', loaded: 4_000_000, total: 8_000_000 },
      200,
    )
    // html 5 + script 15 + frame 25 = 45 · bytes 45 의 절반 22.5
    expect(bootTarget(state, 200)).toBeCloseTo(67.5, 5)
  })
})

describe('bootCeiling', () => {
  it('최소 표시 시간에 걸쳐 0 에서 99 까지 오르고 다시 내려가지 않습니다', () => {
    const state = createBootState(0, true)
    expect(bootCeiling(state, 0)).toBe(0)
    const mid = bootCeiling(state, BOOT_FIRST_MIN_MS / 2)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(BOOT_CEILING)
    expect(bootCeiling(state, BOOT_FIRST_MIN_MS)).toBeCloseTo(BOOT_CEILING, 5)
    expect(bootCeiling(state, BOOT_FIRST_MIN_MS * 3)).toBeCloseTo(
      BOOT_CEILING,
      5,
    )
  })

  it('끝에서도 서지 않습니다 — 마지막 10% 시간에 3 넘게 오릅니다', () => {
    const state = createBootState(0, true)
    const nearEnd = bootCeiling(state, BOOT_FIRST_MIN_MS * 0.9)
    expect(BOOT_CEILING - nearEnd).toBeGreaterThan(3)
  })
})

describe('isBootReady', () => {
  it('배가 붙었거나 오류면 바로, 아니면 기다린 시간으로 정합니다', () => {
    const state = createBootState(0, true)
    expect(isBootReady(state, 1000)).toBe(false)
    expect(isBootReady(ready(state, 1000), 1000)).toBe(true)
    expect(isBootReady(applyBootEvent(state, { stage: 'error' }, 5), 5)).toBe(
      true,
    )
    // 첫 장이 안 오면 20초, 첫 장 뒤 배가 안 오면 12초
    expect(isBootReady(state, BOOT_FRAME_TIMEOUT_MS)).toBe(true)
    const framed = applyBootEvent(state, { stage: 'frame' }, 1000)
    expect(isBootReady(framed, 1000 + BOOT_BOAT_TIMEOUT_MS - 1)).toBe(false)
    expect(isBootReady(framed, 1000 + BOOT_BOAT_TIMEOUT_MS)).toBe(true)
  })
})

describe('bootDisplayTarget', () => {
  it('다 떴어도 최소 표시 시간 전에는 99 를 넘지 않고, 지나면 100 입니다', () => {
    const state = ready(createBootState(0, true), 800)
    expect(bootDisplayTarget(state, 1500)).toBeLessThanOrEqual(BOOT_CEILING)
    expect(bootDisplayTarget(state, BOOT_FIRST_MIN_MS)).toBe(100)
  })

  it('최소 시간이 지나도 덜 받았으면 받은 만큼보다 조금(BOOT_LEAD)만 앞섭니다', () => {
    const state = applyBootEvent(
      createBootState(0, true),
      { stage: 'frame' },
      500,
    )
    const at = BOOT_FIRST_MIN_MS + 1000
    const shown = bootDisplayTarget(state, at)
    expect(shown).toBeLessThan(100)
    expect(shown).toBeCloseTo(
      Math.min(BOOT_CEILING, bootTarget(state, at) + BOOT_LEAD),
      5,
    )
  })
})

describe('parseBootMessage', () => {
  it('엔진 메시지만 신호로 바꾸고 나머지는 null 입니다', () => {
    expect(
      parseBootMessage({
        type: 'pb:boot',
        stage: 'boat-bytes',
        loaded: 10,
        total: 20,
      }),
    ).toMatchObject({ stage: 'boat-bytes', loaded: 10, total: 20 })
    expect(parseBootMessage({ type: 'pb:boot', stage: 'nope' })).toBeNull()
    expect(parseBootMessage({ type: 'vite:ping' })).toBeNull()
    expect(parseBootMessage('pb:boot')).toBeNull()
    expect(parseBootMessage(null)).toBeNull()
  })
})

describe('snapshotEvents', () => {
  it('PB.boot() 스냅샷을 단계 순서의 신호 목록으로 바꿉니다', () => {
    const events = snapshotEvents({
      stages: { frame: 3, script: 2 },
      bytes: { loaded: 1, total: 2 },
      error: null,
    })
    expect(events.map((event) => event.stage)).toEqual([
      'script',
      'frame',
      'boat-bytes',
    ])
    expect(snapshotEvents({ stages: {}, bytes: null, error: null })).toEqual([])
  })
})
