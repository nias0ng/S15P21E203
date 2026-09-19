import { describe, expect, it } from 'vitest'

/*
  ⚠ `node:fs` 가 아니라 Vite 의 `?raw` 로 읽습니다 — 이 앱의 tsconfig 는 브라우저 앱이라
    node 타입을 안 싣고, 싣게 만들면 앱 코드에서도 node API 가 열립니다.
*/
import { CONFIG } from '@landing/config'
import { PARAMS } from '@landing/params'

/*
  ⚠ CSS 만 Vite 의 `?raw` 로 읽습니다 — 내보내는 것이 없어 원문밖에 길이 없습니다.
    엔진 쪽은 `@landing` 별칭으로 **값을** 읽습니다 (engine-dive-params.d.ts).
*/
import appTokens from '../../styles/index.css?raw'
import curtainStyle from '../ui/dive-curtain.css?raw'

import {
  COVER_FROM,
  DIVE_MS,
  diveDuration,
  diveFrameAt,
  LIFT_MS,
  READY_GRACE_MS,
  READY_CAP_MS,
  HOLD_MIN_MS,
  REDUCED_MS,
} from './diveTrack'

/**
 * 잠수 전환의 시계 (메인 3D → 진열대).
 *
 * 화면으로만 볼 수 있는 것(물색 · 카메라)은 여기서 안 봅니다. 대신 **두 판이 어긋나지 않는
 * 조건**만 못 박습니다 — 3D 진행도와 커튼이 같은 0 에서 시작해 같은 1 에서 끝나는가,
 * 커튼이 3D 보다 먼저 올라오지 않는가.
 */
describe('diveFrameAt', () => {
  it('시작에는 아무것도 안 덮는다', () => {
    const frame = diveFrameAt(0)
    expect(frame.k).toBe(0)
    expect(frame.cover).toBe(0)
    expect(frame.covered).toBe(false)
  })

  it('커튼은 3D 가 먼저 움직인 뒤에 차오른다', () => {
    // COVER_FROM 전에는 엔진만 움직인다 — 카메라가 내려가는 것이 먼저 보여야 한다
    expect(diveFrameAt(DIVE_MS * (COVER_FROM - 0.05)).cover).toBe(0)
    expect(diveFrameAt(DIVE_MS * (COVER_FROM + 0.05)).cover).toBeGreaterThan(0)
  })

  it('둘이 같은 끝에서 만난다 — 다 덮은 그 순간이 진행도 1 이다', () => {
    const frame = diveFrameAt(DIVE_MS)
    expect(frame.k).toBe(1)
    expect(frame.cover).toBe(1)
    expect(frame.covered).toBe(true)
  })

  it('시간이 더 흘러도 1 을 넘지 않는다', () => {
    const frame = diveFrameAt(DIVE_MS * 3)
    expect(frame.k).toBe(1)
    expect(frame.cover).toBe(1)
  })

  it('진행도도 커튼도 되돌아가지 않는다', () => {
    let k = -1
    let cover = -1
    for (let at = 0; at <= DIVE_MS; at += 25) {
      const frame = diveFrameAt(at)
      expect(frame.k).toBeGreaterThanOrEqual(k)
      expect(frame.cover).toBeGreaterThanOrEqual(cover)
      k = frame.k
      cover = frame.cover
    }
  })

  it('움직임 줄이기는 짧게 덮는다', () => {
    expect(diveDuration(false)).toBe(DIVE_MS)
    expect(diveDuration(true)).toBe(REDUCED_MS)
    // 짧아져도 규칙은 같다 — 끝에서 다 덮는다
    expect(diveFrameAt(REDUCED_MS, REDUCED_MS).cover).toBe(1)
  })
})

/**
 * ───────── 파일을 건너뛰는 불변식 (2026-09-19) ─────────
 *
 * 잠수는 판 셋(3D 엔진 · 앱 TS · 앱 CSS)에 걸쳐 있어서, **같아야 하는 값이 서로 다른 파일에**
 * 있습니다. 여태 이것을 묶고 있던 것은 주석뿐이었고, 갈라져도 화면을 봐야만 드러났습니다.
 * 한쪽만 고치면 여기서 먼저 걸립니다.
 *
 * ⚠ 값을 **옮겨 적지 않습니다.** 옮겨 적으면 이 파일이 세 번째 출처가 되어, 셋이 갈라질 자리가
 *   하나 더 늘어납니다. 파일에서 읽어 서로 견줍니다.
 */
describe('판을 건너뛰는 값이 갈라지지 않는다', () => {
  /*
    ⚠ CSS 는 내보내는 것이 없어 원문(`?raw`)에서 찾습니다. 찾는 자리는 **정규식 리터럴로 그
      자리에** 적습니다 — 하나로 뭉뚱그리면 주석에 적힌 이름까지 물어 빈 값을 집습니다.
      이 파일들은 값보다 주석이 훨씬 많습니다.
  */
  const pick = (source: string, at: RegExp) => {
    const found = at.exec(source)
    if (!found?.[1]) throw new Error(`${at.source} 를 못 찾았다`)
    return found[1].toLowerCase()
  }

  it('엔진의 diveDeep 과 앱의 --color-navy 가 같은 색이다', () => {
    /*
      덮는 순간 엔진이 칠한 물색과 커튼의 가장 깊은 색이 맞닿습니다. 갈라지면 화면이 다 덮인
      바로 그 프레임에 색이 한 번 튑니다 — 가장 안 보이는 자리에서 가장 눈에 띄는 사고입니다.
      ⚠ 엔진 쪽은 원문이 아니라 **값**으로 읽습니다 (PARAMS.diveDeep) — 엔진이 정말 쓰는 그
        값이라, 주석이나 표기가 바뀌어도 이 검사가 헛돌지 않습니다.
    */
    const app = pick(appTokens, /^\s*--color-navy:\s*(#[0-9A-Fa-f]{6})\s*;/m)
    expect(PARAMS.diveDeep.toLowerCase()).toBe(app)
  })

  it('엔진의 crestViolet 과 앱의 --color-sea-violet 이 같은 색이다', () => {
    /*
      수면 바로 아래의 물이 물고 있는 보라는 3D 마루선의 그 색입니다. 갈라지면 커튼이 덮는
      동안과 걷히는 동안, 물과 파도가 서로 다른 보라를 냅니다 — 한 바다로 안 읽힙니다.
    */
    const app = pick(
      appTokens,
      /^\s*--color-sea-violet:\s*(#[0-9A-Fa-f]{6})\s*;/m,
    )
    expect(CONFIG.color.crestViolet.toLowerCase()).toBe(app)
  })

  it('LIFT_MS 와 CSS 의 --dive-lift 가 같은 길이다', () => {
    /*
      커튼을 치우는 것은 TS(LIFT_MS 뒤에 언마운트)이고 실제로 걷는 것은 CSS(--dive-lift)입니다.
      TS 가 짧으면 다 걷히기 전에 판이 사라지고, 길면 다 걷힌 빈 판이 클릭을 먹습니다.
    */
    const css = pick(curtainStyle, /^\s*--dive-lift:\s*(\d+)ms\s*;/m)
    expect(css).toBe(String(LIFT_MS))
  })

  it('목록 유예를 더해도 커튼의 상한에 못 미친다', () => {
    /*
      유예(READY_GRACE_MS)는 사진을 기다려 주는 시간이지 상한을 대신하는 것이 아닙니다.
      최소 잔류까지 더한 값이 상한에 닿으면 유예가 아무 일도 안 하게 됩니다.
    */
    expect(HOLD_MIN_MS + READY_GRACE_MS).toBeLessThan(READY_CAP_MS)
  })
})
