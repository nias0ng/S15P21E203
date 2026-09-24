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
import roomStyle from '../../styles/scent-display.css?raw'
import { ROUTES } from '../config/routes'
import curtainStyle from '../ui/dive-curtain.css?raw'

import {
  COVER_FROM,
  DIVE_DEPTH,
  DIVE_MS,
  DIVE_MS_DEEP,
  diveDepthOf,
  diveDuration,
  diveFrameAt,
  diveMsAt,
  LIFT_MS,
  READY_GRACE_MS,
  READY_CAP_MS,
  HOLD_MIN_MS,
  REDUCED_MS,
  RISE_CAP_MS,
  riseDepthOf,
} from './diveTrack'

/**
 * 잠수 전환의 시계 (메인 3D ↔ 콘텐츠 화면).
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

  it('깊어도 구간의 모양은 같다 — 길이만 늘어난다', () => {
    /*
      깊이는 시간을 늘릴 뿐이고 `COVER_FROM` 도 '다 덮는 끝' 도 **비율**이다. 하나라도
      절대 시간으로 새면 깊은 화면에서 커튼이 3D 보다 먼저 올라오거나 늦게 닿는다.
    */
    const deep = diveMsAt(1)
    expect(diveFrameAt(deep * (COVER_FROM - 0.05), deep).cover).toBe(0)
    expect(diveFrameAt(deep, deep).cover).toBe(1)
    expect(diveFrameAt(deep, deep).covered).toBe(true)
  })
})

/**
 * ───────── 깊이 — 화면마다 다른 바닥 (2026-09-20) ─────────
 *
 * 다섯 화면이 **한 축 위에** 있다는 것이 이 연출의 전부입니다. 축이 깨지는 길은 둘인데
 * (순서가 뒤집히거나, 어느 화면이 축에서 빠지거나) 둘 다 화면을 나란히 놓고 봐야만 드러납니다.
 */
describe('깊이', () => {
  /** 헤더 왼쪽에서 오른쪽 — 이 순서가 곧 깊어지는 순서다 (`DIVE_DEPTH` 머리말) */
  const IN_HEADER_ORDER = [
    '/perfumes',
    '/brands',
    '/notes',
    '/community/reviews',
    '/community/free',
  ]

  it('잠수하는 화면은 이 다섯이다', () => {
    /*
      ⚠ 주소를 **옮겨 적었습니다** — 이 한 곳이 예외입니다. `ROUTES` 를 그대로 쓰면
        "표에 있는 것이 표에 있다" 는 동어반복이 되어, 화면을 하나 빼거나 더해도 안 걸립니다.
        여기서 걸리면 *일부러 바꾼 것인가* 를 한 번 되묻게 되는데, 그게 이 검사의 일입니다.
    */
    expect(Object.keys(DIVE_DEPTH).sort()).toEqual([...IN_HEADER_ORDER].sort())
  })

  it('헤더를 오른쪽으로 갈수록 깊어진다', () => {
    const depths = IN_HEADER_ORDER.map((path) => diveDepthOf(path))
    expect(depths).toEqual([...depths].sort((a, b) => (a ?? 0) - (b ?? 0)))
    // 같은 깊이가 둘 있으면 그 두 화면은 구분이 안 된다
    expect(new Set(depths).size).toBe(depths.length)
  })

  it('깊이는 0 보다 크고 1 을 안 넘는다', () => {
    /*
      0 이면 그 화면만 여태의 진열대와 같은 끝 색이 되고, 1 을 넘으면 `--sea-abyss` 보다
      깊은 색을 CSS 가 만들어 냅니다 (`color-mix` 가 비율을 자르지 않습니다).
    */
    for (const depth of Object.values(DIVE_DEPTH)) {
      expect(depth).toBeGreaterThan(0)
      expect(depth).toBeLessThanOrEqual(1)
    }
  })

  it('들어가는 문은 목록 다섯뿐이다', () => {
    /*
      메인은 출발지고, 진열대는 2026-09-20 에 빠졌고(별도 연출), 상세로 **내려가는** 길은
      아예 없습니다 — 헤더가 목록만 내줍니다. 나오는 문은 아래 `riseDepthOf` 가 더 넓습니다.
    */
    expect(diveDepthOf('/')).toBeNull()
    expect(diveDepthOf('/shelf')).toBeNull()
    expect(diveDepthOf('/perfumes/12')).toBeNull()
    expect(diveDepthOf('/community/posts/3')).toBeNull()
  })

  it('상세는 부모 목록의 깊이로 떠오른다', () => {
    /*
      ⭐ 2026-09-20 에 고친 자리입니다. 그전에는 `/brands` 에서만 떠오르고 `/brands/79` 에서는
        로고가 순간이동해서, 바다로 내려갔다가 방 하나 건너간 것뿐인데 수면으로 튕겼습니다.
      ⚠ **부모의 깊이**를 그대로 씁니다 — 상세마다 따로 주면 방 안에서 움직일 때마다 바닥이
        바뀌는데, 그 사이에는 물이 안 차므로 아무도 그 차이를 못 봅니다.
    */
    const 같음 = (child: string, list: string) =>
      expect([child, riseDepthOf(child)]).toEqual([child, diveDepthOf(list)])

    같음('/perfumes/12', ROUTES.PERFUMES)
    같음('/brands/79', ROUTES.BRANDS)
    같음('/notes/5', ROUTES.NOTES)
    // 주소가 제 목록 아래에 안 달린 둘 — 화면은 그 방 것이다
    같음('/reviews/3', ROUTES.COMMUNITY_REVIEWS)
    같음('/community/posts/3', ROUTES.COMMUNITY_FREE)
    // 글쓰기 · 고치기도 같은 방이다 (docs/어두운-방-유리판.md 의 묶음 그대로)
    같음('/community/reviews/write', ROUTES.COMMUNITY_REVIEWS)
    같음('/community/reviews/3/edit', ROUTES.COMMUNITY_REVIEWS)
    같음('/community/free/write', ROUTES.COMMUNITY_FREE)
    같음('/community/free/3/edit', ROUTES.COMMUNITY_FREE)
  })

  it('목록 다섯은 들어갈 때와 나올 때의 깊이가 같다', () => {
    // 내려간 만큼 올라옵니다 — 갈라지면 같은 화면이 들어갈 때와 나올 때 다른 바다가 됩니다
    for (const path of IN_HEADER_ORDER) {
      expect([path, riseDepthOf(path)]).toEqual([path, diveDepthOf(path)])
    }
  })

  it('앞머리가 겹쳐 보이는 남을 안 집는다', () => {
    /*
      ⚠ 앞머리로 보는 방식의 함정입니다 — `startsWith` 만 쓰면 `/notesomething` 이 `/notes` 의
        방으로 들어옵니다. 경계(`/` 또는 끝)까지 봐야 합니다.
    */
    expect(riseDepthOf('/notesomething')).toBeNull()
    expect(riseDepthOf('/brands-archive')).toBeNull()
    expect(riseDepthOf('/community/reviewsx')).toBeNull()
  })

  it('앱의 모든 주소가 어느 방인지 정해져 있다', () => {
    /*
      ⚠⚠ **`routes.ts` 에 화면이 하나 늘면 여기서 걸립니다** — "떠오를 곳인가" 를 그때 정하라는
        뜻입니다. 2026-09-20 에 상세가 빠졌던 것이 바로 이 물음을 아무도 안 물어서였습니다.
      ⚠ 라우트 패턴(`/perfumes/:perfumeId`)을 그대로 넣습니다 — 앞머리로 보므로 실제 주소와
        같은 방이 나옵니다. 채워 넣은 주소는 위 검사가 따로 봅니다.
      ⚠ 값이 아니라 **방 이름**으로 적습니다. 깊이 숫자를 옮겨 적으면 표를 손볼 때마다 여기도
        같이 고쳐야 하고, 그러면 이 검사가 표를 그냥 따라 적는 종이가 됩니다.
    */
    const 방: Record<keyof typeof ROUTES, string | null> = {
      HOME: null, // 출발지
      PERFUMES: ROUTES.PERFUMES,
      PERFUME_DETAIL: ROUTES.PERFUMES,
      REVIEW_DETAIL: ROUTES.COMMUNITY_REVIEWS,
      BRANDS: ROUTES.BRANDS,
      BRAND_DETAIL: ROUTES.BRANDS,
      NOTES: ROUTES.NOTES,
      NOTE_DETAIL: ROUTES.NOTES,
      TASTE_TEST: null, // 온보딩 임시 경로 — 어두운 방이 아니다
      MY_SHELF: null, // 2026-09-20 에 빠졌다 (배 선실 연출로 갑니다)
      COLLECTION_DETAIL: null, // 진열대 도메인 — 진열대가 빠지면 같이 빠진다
      COMMUNITY_REVIEWS: ROUTES.COMMUNITY_REVIEWS,
      COMMUNITY_FREE: ROUTES.COMMUNITY_FREE,
      POST_DETAIL: ROUTES.COMMUNITY_FREE,
      REVIEW_WRITE: ROUTES.COMMUNITY_REVIEWS,
      REVIEW_EDIT: ROUTES.COMMUNITY_REVIEWS,
      POST_WRITE: ROUTES.COMMUNITY_FREE,
      POST_EDIT: ROUTES.COMMUNITY_FREE,
      LOGIN: null,
      SIGNUP: null,
      PASSWORD_RESET: null,
      ACCOUNT: null,
    }

    for (const [name, pattern] of Object.entries(ROUTES)) {
      const list = 방[name as keyof typeof ROUTES]
      expect([name, riseDepthOf(pattern)]).toEqual([
        name,
        list === null ? null : diveDepthOf(list),
      ])
    }
  })

  it('깊을수록 오래 내려간다 — 양끝은 못 벗어난다', () => {
    expect(diveMsAt(0)).toBe(DIVE_MS)
    expect(diveMsAt(1)).toBe(DIVE_MS_DEEP)
    expect(DIVE_MS_DEEP).toBeGreaterThan(DIVE_MS)
    // 범위 밖이 들어와도 양끝에서 멈춘다 (커튼이 음수 시간으로 돌지 않게)
    expect(diveMsAt(-1)).toBe(DIVE_MS)
    expect(diveMsAt(9)).toBe(DIVE_MS_DEEP)

    let last = 0
    for (const path of IN_HEADER_ORDER) {
      const at = diveMsAt(diveDepthOf(path) ?? 0)
      expect(at).toBeGreaterThan(last)
      last = at
    }
  })

  it('움직임 줄이기는 깊이를 안 본다', () => {
    /*
      깊이는 '내려가는 동안' 을 길게 하는 값이고, 움직임 줄이기는 내려가는 것 자체를 뺀
      자리입니다. 여기서 깊이가 들면 카메라도 안 내려가는데 커튼만 1.5초를 씁니다.
    */
    expect(diveDuration(true, 1)).toBe(REDUCED_MS)
    expect(diveDuration(false, 1)).toBe(DIVE_MS_DEEP)
  })
})

/**
 * ───────── 파일을 건너뛰는 불변식 (2026-09-19) ─────────
 *
 * 잠수는 판 셋(3D 엔진 · 앱 TS · 앱 CSS)에 걸쳐 있어서, **같아야 하는 값이 서로 다른 파일에**
 * 있습니다. 여태 이것을 묶고 있던 것은 주석뿐이었고, 갈라져도 화면을 봐야만 드러났습니다.
 * 한쪽만 고치면 여기서 먼저 걸립니다.
 *
 * NOTE: 값을 **옮겨 적지 않습니다.** 옮겨 적으면 이 파일이 세 번째 출처가 되어, 셋이 갈라질 자리가
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

  it('깊이 0 의 바닥이 인계 색이다 — 위 검사가 헛돌지 않는다', () => {
    /*
      위 검사(`diveDeep` == `--color-navy`)가 뜻을 가지려면, 커튼이 **정말로** 그 색에서
      출발해야 합니다. 2026-09-20 에 굳은 속이 고정색에서 `--dive-floor` 로 바뀌었으니,
      이제 인계는 두 줄에 걸려 있습니다 : 기준색이 navy 인가 · 기본 깊이가 0 인가.
      둘 중 하나만 틀어져도 커튼이 덮는 순간 색이 한 번 튑니다 — 위 검사는 그대로 통과합니다.
    */
    expect(
      /--dive-floor:\s*color-mix\([^;]*var\(--color-navy\)\s*\)/.test(
        curtainStyle,
      ),
    ).toBe(true)
    expect(pick(curtainStyle, /^\s*--dive-depth:\s*(0%)\s*;/m)).toBe('0%')
  })

  it('물판의 굳은 속이 바닥 색을 쓴다 — 깊이가 헛돌지 않는다', () => {
    /*
      깊이는 `--dive-floor` 를 통해서만 화면에 닿습니다. 굳은 속을 다시 고정색으로 적으면
      TS 는 멀쩡히 깊이를 넘기고 CSS 는 무시해서, **다섯이 조용히 한 색이 됩니다.**
      ⚠ 두 자리입니다 — 가라앉는 판과 뒤집힌 판(`[data-way='rise']`).
    */
    const stops = curtainStyle.match(/var\(--dive-floor\) (?:0|38)%/g) ?? []
    expect(stops).toHaveLength(4)
  })

  it('떠오르는 커튼이 떠나는 방의 물빛을 쓴다 — 방이 내주는 이름을 커튼이 읽는다', () => {
    /*
      떠오르기의 색은 방(`.scent-night`)이 내주고 커튼 CSS 가 씁니다. 한쪽만 이름이 어긋나도
      **아무 오류 없이** 바다색으로 물러서서, 남색 방 위로 청록 띠가 다시 내려옵니다
      (2026-09-24 사용자 : *"녹색이 섞여있는 블루"*).
      ⚠ 이름을 바꾸면 `DiveCurtain` 의 `ROOM_WATER` 도 같이 바꿉니다 — 방을 떠나기 전에 값을
        커튼에 옮겨 적는 목록입니다. 거기만 어긋나면 메인으로 넘어간 뒤에 색이 한 번 튑니다.
      ⚠ 색 값은 안 봅니다 — 무엇으로 덮을지는 방이 정할 일이고, 여기는 **이어져 있는가**만 봅니다.
    */
    for (const name of ['--room-water', '--room-water-deep']) {
      expect(roomStyle).toMatch(new RegExp(`^\\s*${name}:`, 'm'))
      expect(curtainStyle).toContain(`var(${name},`)
    }
  })

  it('가장 깊은 물이 navy 보다 어둡다', () => {
    /*
      ⚠⚠ **깊이 축의 방향입니다.** `--sea-abyss` 가 navy 보다 밝으면 깊은 화면이 더 **밝게**
        끝나서, 같은 값이 '더 깊다' 와 '더 얕다' 를 동시에 뜻하게 됩니다 — 시간은 길어지는데
        색은 얕아지므로 두 신호가 서로를 지웁니다. 색을 고르는 것은 화면의 일이지만
        **어느 쪽이 어두운가**는 값의 일이라 여기서 못 박습니다.
      ⚠ 얼마나 어두운가는 안 봅니다 (그것이 화면으로 정할 값입니다).
    */
    const lum = (hex: string) => {
      const channel = (at: number) => {
        const v = parseInt(hex.slice(at, at + 2), 16) / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
    }
    const navy = pick(appTokens, /^\s*--color-navy:\s*(#[0-9A-Fa-f]{6})\s*;/m)
    const abyss = pick(
      curtainStyle,
      /^\s*--sea-abyss:\s*(#[0-9A-Fa-f]{6})\s*;/m,
    )
    expect(lum(abyss)).toBeLessThan(lum(navy))
  })

  it('떠오르는 상한이 최소 잔류보다 길다', () => {
    /*
      2026-09-20 에 `RISE_CAP_MS` 를 5000 → 2500 으로 내렸습니다 (엔진이 늦으면 커튼이 먼저
      걷힙니다). 더 내리는 것이 다음 수인데, `HOLD_MIN_MS` 아래로 가면 상한이 **최소 잔류를
      앞질러** 커튼이 덮은 그 자리에서 곧바로 걷힙니다 — 떠오르는 연출이 통째로 사라집니다.
    */
    expect(RISE_CAP_MS).toBeGreaterThan(HOLD_MIN_MS)
  })

  it('목록 유예를 더해도 커튼의 상한에 못 미친다', () => {
    /*
      유예(READY_GRACE_MS)는 사진을 기다려 주는 시간이지 상한을 대신하는 것이 아닙니다.
      최소 잔류까지 더한 값이 상한에 닿으면 유예가 아무 일도 안 하게 됩니다.
    */
    expect(HOLD_MIN_MS + READY_GRACE_MS).toBeLessThan(READY_CAP_MS)
  })
})
