import { describe, expect, it } from 'vitest'

import {
  BOOT_BOAT_TIMEOUT_MS,
  BOOT_FIRST_MIN_MS,
  BOOT_FRAME_TIMEOUT_MS,
  BOOT_MOUNT_FLOOR_MS,
  BOOT_REVISIT_MIN_MS,
  applyBootEvent,
  createBootState,
  isBootReady,
  parseBootMessage,
  snapshotEvents,
  type SceneBootState,
} from './bootProgress'

const ready = (state: SceneBootState, at: number): SceneBootState =>
  applyBootEvent(state, { stage: 'boat' }, at)

describe('createBootState', () => {
  it('첫 진입은 항해 시작(0)부터 세고, 최소 표시 시간과 마운트 뒤 여유 중 늦은 쪽까지 보여 줍니다', () => {
    expect(createBootState(500, true)).toMatchObject({
      // 커튼 시계는 항해 시작(0)이지만 엔진을 기다리기 시작한 것은 지금입니다
      watchedAt: 500,
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
      watchedAt: 9000,
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

  it('오류는 문구를 남깁니다', () => {
    expect(
      applyBootEvent(base, { stage: 'error', message: 'boom' }, 10).error,
    ).toBe('boom')
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

  /*
   * 2026-09-23 회귀 — 첫 접속에서 구름이 엔진을 안 기다리고 걷히던 버그.
   * 첫 진입의 커튼 시계는 0(항해 시작)인데 그 시계로 첫 장 상한을 세면, 번들 받는 시간이
   * 엔진 예산에서 그대로 까입니다. 12초에 마운트되면 엔진에게 남는 것은 8초뿐이었습니다.
   */
  it('첫 장 상한은 항해 시작이 아니라 엔진을 기다리기 시작한 때부터 셉니다', () => {
    // 번들이 늦게 와 12초에 마운트됐습니다 — 엔진은 그때부터 뜨기 시작합니다
    const late = createBootState(12000, true)
    // 항해 시작(0)부터 셌다면 여기서 이미 걷혔습니다
    expect(isBootReady(late, BOOT_FRAME_TIMEOUT_MS)).toBe(false)
    expect(isBootReady(late, 12000 + BOOT_FRAME_TIMEOUT_MS - 1)).toBe(false)
    expect(isBootReady(late, 12000 + BOOT_FRAME_TIMEOUT_MS)).toBe(true)
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
    ).toMatchObject({ stage: 'boat-bytes' })
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
      error: null,
    })
    expect(events.map((event) => event.stage)).toEqual(['script', 'frame'])
    expect(snapshotEvents({ stages: {}, error: null })).toEqual([])
  })
})
