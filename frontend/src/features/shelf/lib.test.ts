import { describe, expect, it } from 'vitest'

import {
  formatShelfDate,
  layoutWall,
  LIFT_ENVELOPE,
  liftEnvelope,
  liftStep,
  liftTarget,
  meterWheel,
  nameWithoutBrand,
  nearStop,
  nextStop,
  plaqueMetrics,
  plaquePath,
  revealItem,
  revealStart,
  sectionAt,
  shelfLayout,
  shelfMetrics,
  slotView,
  snapStart,
  springStep,
  swingStep,
  TAG_WIDTH,
  tagMetrics,
  ticketPath,
  wallStops,
  WHEEL_IDLE,
  wheelStop,
  type GustDirection,
  type Spring,
  type Swing,
  type WallLayout,
  type WheelMeter,
} from './lib'
import type { ShelfItem, ShelfSection } from './types'

describe('nameWithoutBrand', () => {
  it('이름 앞에 붙은 브랜드를 뗀다 — 띄어쓰기가 달라도 같은 브랜드로 본다', () => {
    expect(nameWithoutBrand('조 말론 우드 세이지 앤 씨 솔트', '조말론')).toBe(
      '우드 세이지 앤 씨 솔트',
    )
    expect(
      nameWithoutBrand('메종 마르지엘라 레이지 선데이 모닝', '메종 마르지엘라'),
    ).toBe('레이지 선데이 모닝')
  })

  it('브랜드 이름의 앞부분만 적힌 경우도 뗀다', () => {
    expect(nameWithoutBrand('입생로랑 리브르', '입생로랑뷰티')).toBe('리브르')
  })

  it('앞에서 한 번만 떼고, 이름 뒤쪽의 브랜드 낱말은 남긴다', () => {
    expect(nameWithoutBrand('디올 미스 디올', '디올')).toBe('미스 디올')
  })

  it('브랜드로 시작하지 않으면 그대로 둔다', () => {
    expect(nameWithoutBrand('블루 드 샤넬', '샤넬')).toBe('블루 드 샤넬')
  })

  it('이름이 브랜드뿐이면 비우지 않고 그대로 둔다', () => {
    expect(nameWithoutBrand('샤넬', '샤넬')).toBe('샤넬')
  })

  it('한두 글자만 우연히 겹치는 이름은 자르지 않는다', () => {
    expect(nameWithoutBrand('로라 스카이', '로라메르시에')).toBe('로라 스카이')
  })
})

describe('formatShelfDate', () => {
  it('ISO 문자열을 YYYY.MM.DD 로 적는다', () => {
    // 지역 시간대와 무관하게 같은 날이 되도록 한낮을 씁니다
    expect(formatShelfDate('2026-08-20T12:00:00Z')).toBe('2026.08.20')
  })

  it('한 자리 월과 일에 0 을 채운다', () => {
    expect(formatShelfDate('2026-01-05T12:00:00Z')).toBe('2026.01.05')
  })

  it('메모를 쓴 적이 없으면 null 을 준다', () => {
    expect(formatShelfDate(null)).toBeNull()
  })

  it('날짜로 읽을 수 없는 값에도 화면을 깨뜨리지 않는다', () => {
    expect(formatShelfDate('어제')).toBeNull()
  })
})

describe('swingStep', () => {
  // useTagSwing 의 값 — 주기 0.95초 · 감쇠비 0.3 · 1/3000 · 한도 8도
  const OPTIONS = {
    omega: (2 * Math.PI) / 0.95,
    damping: 0.3,
    gain: 1 / 3000,
    limit: (8 * Math.PI) / 180,
  }
  const STILL: Swing = { angle: 0, speed: 0 }
  const FRAME = 1 / 60

  /** 가속도를 받지 않고 몇 초 동안 흔들리게 둡니다 */
  const settle = (from: Swing, seconds: number) => {
    let swing = from
    for (let t = 0; t < seconds; t += FRAME) {
      swing = swingStep(swing, 0, FRAME, OPTIONS)
    }
    return swing
  }

  it('매단 점이 오른쪽으로 가속하면 태그 아랫단이 왼쪽으로 뒤처진다', () => {
    expect(swingStep(STILL, 5000, FRAME, OPTIONS).angle).toBeGreaterThan(0)
  })

  it('왼쪽으로 가속하면 반대로 기운다', () => {
    expect(swingStep(STILL, -5000, FRAME, OPTIONS).angle).toBeLessThan(0)
  })

  it('밀던 힘이 사라지면 몇 번 오가다 멈춘다', () => {
    // 감쇠 e^(−ζωt): 6초면 처음 흔들림의 0.4% 아래로 가라앉습니다
    const rest = settle({ angle: 0.2, speed: 0 }, 6)
    expect(Math.abs(rest.angle)).toBeLessThan(0.002)
  })

  it('한 번은 반대쪽으로 넘어간다 — 감쇠가 너무 세면 흔들림이 아니라 쓰러짐이 된다', () => {
    const half = settle({ angle: 0.2, speed: 0 }, Math.PI / OPTIONS.omega)
    expect(half.angle).toBeLessThan(0)
  })

  it('아무리 세게 밀어도 한도(8도)를 넘지 않는다', () => {
    expect(swingStep(STILL, 1e9, FRAME, OPTIONS).angle).toBe(OPTIONS.limit)
    expect(swingStep(STILL, -1e9, FRAME, OPTIONS).angle).toBe(-OPTIONS.limit)
  })

  it('한도에 닿으면 바깥으로 가던 속도를 버린다 — 미는 힘이 사라지면 곧바로 한도에서 떨어진다', () => {
    let swing = STILL
    // 0.5초 동안 한도 너머로 세게 밉니다
    for (let t = 0; t < 0.5; t += FRAME) {
      swing = swingStep(swing, 1e6, FRAME, OPTIONS)
    }
    expect(swing.angle).toBe(OPTIONS.limit)
    expect(swing.speed).toBe(0)
    // 쌓인 속도가 없어서, 힘을 거두면 다음 프레임부터 되돌아옵니다
    swing = swingStep(swing, 0, FRAME, OPTIONS)
    expect(swing.angle).toBeLessThan(OPTIONS.limit)
  })

  it('이웃한 두 태그가 서로 반대로 한도까지 기울어도 아랫모서리가 닿지 않는다 — 1920 · 390', () => {
    const cases = [
      shelfLayout(1800, 800, { panel: true }),
      shelfLayout(350, 380, { panel: false }),
    ]
    for (const metrics of cases) {
      const half = metrics.tagWidth / 2
      // 회전축(줄 윗끝)에서 태그 아랫모서리까지 — 가로 반폭, 세로 줄 + 태그
      const reach =
        half * Math.cos(OPTIONS.limit) +
        (metrics.cord + metrics.tagHeight) * Math.sin(OPTIONS.limit) -
        half
      expect(reach).toBeLessThan((metrics.pitch - metrics.tagWidth) / 2)
    }
  })
})

const DIRECTIONS: GustDirection[] = ['leave', 'arrive']

describe('liftEnvelope', () => {
  it('바람을 일으키고 40ms 까지는 0 이다 — 공기가 따라 움직이기까지', () => {
    for (const direction of DIRECTIONS) {
      for (const t of [-0.1, 0, 0.02, 0.04]) {
        expect(liftEnvelope(t, direction)).toBe(0)
      }
    }
  })

  it('가장 셀 때 1 로 버틴다 — 떠날 때 180 ~ 260ms, 돌아올 때 120 ~ 200ms', () => {
    for (const t of [0.18, 0.22, 0.26]) {
      expect(liftEnvelope(t, 'leave')).toBeCloseTo(1, 10)
    }
    for (const t of [0.12, 0.16, 0.2]) {
      expect(liftEnvelope(t, 'arrive')).toBeCloseTo(1, 10)
    }
  })

  it('잦아들면 0 이다 — 떠날 때 520ms, 돌아올 때 430ms 부터', () => {
    for (const t of [0.52, 0.6, 2]) expect(liftEnvelope(t, 'leave')).toBe(0)
    for (const t of [0.43, 0.5, 2]) expect(liftEnvelope(t, 'arrive')).toBe(0)
  })

  it('끊김 없이 이어진다 — 0.5ms 마다 1.1% 넘게 뛰지 않고 늘 0 ~ 1 이다', () => {
    for (const direction of DIRECTIONS) {
      let previous = liftEnvelope(-0.05, direction)
      for (let t = -0.05; t <= 0.7; t += 0.0005) {
        const value = liftEnvelope(t, direction)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
        expect(Math.abs(value - previous)).toBeLessThan(0.011)
        previous = value
      }
    }
  })
})

describe('liftTarget · liftStep', () => {
  const DEG = Math.PI / 180
  // useTagSwing 의 값 — 주기 0.62초 · 감쇠비 0.34 · 벽 −1.5도 · 되튐 0.35
  const OPTIONS = {
    omega: (2 * Math.PI) / 0.62,
    damping: 0.34,
    floor: -1.5 * DEG,
    bounce: 0.35,
  }
  // 바람 세기(떠날 때 17도 · 돌아올 때 12도) · 보이는 한도 26도 · 가라앉음 0.2도
  const WIND = { leave: 17 * DEG, arrive: 12 * DEG }
  const CAP = 26 * DEG
  const REST = 0.2 * DEG
  const STEP = 1 / 120

  /**
   * 창에 걸친 태그 열둘(세기 0.85 ~ 1.15 · 난류 위상 · 창 끝으로 갈수록 45ms 까지 늦음)을 바람에
   * 3초 동안 굴려, 걸음마다 전부의 들림을 모읍니다.
   */
  const blow = (direction: GustDirection) => {
    const tags = Array.from({ length: 12 }, (_, at) => ({
      shape: {
        gain: 0.85 + 0.3 * ((at * 0.618034) % 1),
        phase: 2 * Math.PI * ((at * 0.381966) % 1),
        lag: (0.045 * Math.abs(at - 5.5)) / 5.5,
      },
      lift: { angle: 0, speed: 0 } as Swing,
    }))
    const trail: { t: number; lifts: Swing[] }[] = []
    for (let count = 1; count <= 360; count += 1) {
      const t = count * STEP
      for (const tag of tags) {
        const target = liftTarget(t, direction, WIND[direction], tag.shape)
        tag.lift = liftStep(tag.lift, target, STEP, OPTIONS)
      }
      trail.push({ t, lifts: tags.map((tag) => tag.lift) })
    }
    return trail
  }
  const angles = (trail: { lifts: Swing[] }[]) =>
    trail.flatMap(({ lifts }) => lifts.map((lift) => lift.angle))
  const shown = (angle: number) => CAP * Math.tanh(angle / CAP)

  it('바람이 없으면 들리지 않는다', () => {
    const shape = { gain: 1, phase: 0, lag: 0 }
    expect(liftTarget(0.01, 'leave', WIND.leave, shape)).toBe(0)
    expect(liftTarget(1, 'arrive', WIND.arrive, shape)).toBe(0)
  })

  it('떠나는 바람에 8도 넘게 들리고, 보이는 들림은 26도를 넘지 않는다', () => {
    const peak = shown(Math.max(...angles(blow('leave'))))
    expect(peak).toBeGreaterThan(8 * DEG)
    expect(peak).toBeLessThanOrEqual(CAP)
  })

  it('돌아오는 바람은 더 약하다 — 보이는 들림이 20도 아래', () => {
    const peak = shown(Math.max(...angles(blow('arrive'))))
    expect(peak).toBeGreaterThan(8 * DEG)
    expect(peak).toBeLessThan(20 * DEG)
  })

  it('벽보다 뒤로(−1.5도) 넘어가지 않고, 떨어지며 벽을 한 번은 친다', () => {
    for (const direction of DIRECTIONS) {
      const lowest = Math.min(...angles(blow(direction)))
      expect(lowest).toBeGreaterThanOrEqual(OPTIONS.floor)
      expect(lowest).toBeCloseTo(OPTIONS.floor, 10)
    }
  })

  it('벽에 닿으면 그 자리에 서서 되튄다', () => {
    const hit = liftStep({ angle: 0, speed: -2 }, 0, 1 / 60, OPTIONS)
    expect(hit.angle).toBe(OPTIONS.floor)
    expect(hit.speed).toBeGreaterThan(0)
  })

  it('돌아오는 바람은 1.4초 안에 모든 태그가 가라앉고, 그 뒤로 다시 보일 만큼 들리지 않는다', () => {
    const trail = blow('arrive')
    const end = LIFT_ENVELOPE.arrive.end + 0.045
    const calm = trail.find(
      ({ t, lifts }) =>
        t >= end &&
        lifts.every(
          (lift) =>
            Math.abs(lift.angle) < REST && Math.abs(lift.speed) < REST * 10,
        ),
    )
    expect(calm?.t).toBeLessThanOrEqual(1.4)
    const after = trail.filter(({ t }) => t > (calm?.t ?? 0))
    expect(Math.max(...angles(after).map(Math.abs))).toBeLessThan(REST)
  })
})

describe('springStep', () => {
  // useShelfFlow 의 값 — 고유 진동수 14 · 감쇠비 1.25 · 속도 한도 24 칸/초
  const OPTIONS = { omega: 14, damping: 1.25, maxSpeed: 24 }
  const DT = 1 / 240

  /** 서 있던 벽(0)을 dest 로 몇 초 동안 끌어당기며 지나온 상태를 모읍니다 */
  const pull = (seconds: number, options = OPTIONS, dest = 1) => {
    let spring: Spring = { position: 0, velocity: 0 }
    const trail: Spring[] = []
    for (let step = 0; step < Math.round(seconds / DT); step += 1) {
      spring = springStep(spring, dest, DT, options)
      trail.push(spring)
    }
    return trail
  }

  it('휠 한 번(1920 칸 폭 182.5px)은 1초가 지나면 0.5px 안쪽에 붙어 있다', () => {
    const settled = pull(2).slice(Math.round(1 / DT))
    const farthest = Math.max(
      ...settled.map(({ position }) => Math.abs(1 - position)),
    )
    expect(farthest * 182.5).toBeLessThan(0.5)
  })

  it('넘지 않고 끝을 천천히 들어간다 — 90% 까지는 0.4초 안, 남은 10% 에 0.4초 넘게', () => {
    const trail = pull(2)
    const peak = Math.max(...trail.map(({ position }) => position))
    expect(peak).toBeLessThanOrEqual(1)
    const ninety = trail.findIndex(({ position }) => position >= 0.9) * DT
    const close =
      trail.findIndex(({ position }) => (1 - position) * 182.5 < 0.5) * DT
    expect(ninety).toBeLessThan(0.4)
    expect(close - ninety).toBeGreaterThan(0.4)
  })

  it('감쇠비 1 이어도 넘어가지 않는다', () => {
    const peak = Math.max(
      ...pull(1, { ...OPTIONS, damping: 1 }).map(({ position }) => position),
    )
    expect(peak).toBeLessThanOrEqual(1)
  })

  it('멀리 끌어당겨도 속도가 한도를 넘지 않는다', () => {
    const fastest = Math.max(
      ...pull(2, OPTIONS, 10).map(({ velocity }) => Math.abs(velocity)),
    )
    expect(fastest).toBe(OPTIONS.maxSpeed)
  })

  it('목적지를 뒤로 바꿔도 속도를 이어받는다 — 한 걸음에 뚝 서지 않는다', () => {
    const moving: Spring = { position: 0.5, velocity: 6 }
    const turned = springStep(moving, 0, DT, OPTIONS)
    expect(turned.velocity).toBeGreaterThan(0)
    expect(turned.position).toBeGreaterThan(moving.position)
  })
})

describe('shelfMetrics', () => {
  it('1920 x 1080 의 진열장 자리(1800 x 800, 가리지 않는 폭 1440)에서 벽감 605 · 병 360 · 칸 200 이 된다', () => {
    const metrics = shelfMetrics(1800, 800, 1440)
    expect(metrics.caseHeight).toBe(605)
    expect(metrics.bottle).toBe(360)
    expect(metrics.visible).toBe(9)
    expect(metrics.whole).toBe(9)
    expect(metrics.pitch).toBe(200)
    expect(metrics.clear).toBe(7)
  })

  it('1920 x 1080 자리를 패널 없이 세면(칸 폭 200) 이름표는 태그 150 x 95 · 줄 35 이고, 이름표 자리는 145 다', () => {
    const { tagWidth, tagHeight, cord, hang } = shelfMetrics(1800, 800, 1440)
    // 태그 글자는 폭 170 태그를 기준으로 줄어듭니다(--tag-scale)
    expect(TAG_WIDTH).toBe(170)
    expect(tagWidth).toBe(150)
    expect(tagHeight).toBe(95)
    expect(cord).toBe(35)
    expect(hang).toBe(145)
  })

  it('병 사진은 벽감 높이의 60% 로 서고, 칸을 좁혀도 벽감 높이는 그대로다', () => {
    // 1440 x 900 의 진열장 자리(1340 x 600, 가리지 않는 폭 1020). 벽감 440 은 예전과 같은 값입니다
    const { caseHeight, bottle, hang } = shelfMetrics(1340, 600, 1020)
    expect(caseHeight).toBe(440)
    expect(bottle).toBe(260)
    expect(hang).toBe(120)
  })

  it('가리지 않는 칸은 패널에 가리지 않는 폭 안에 온전히 들어간다', () => {
    const { clear, pitch } = shelfMetrics(1800, 800, 1440)
    expect(clear * pitch).toBeLessThanOrEqual(1440)
    expect((clear + 1) * pitch).toBeGreaterThan(1440)
  })

  it('칸 수 x 칸 폭이 창 폭과 같다 — 어긋나면 끝 병이 창 경계에 걸린다', () => {
    for (const width of [860, 1020, 1337, 1440, 1785]) {
      const { visible, pitch } = shelfMetrics(width, 610)
      expect(visible * pitch).toBeCloseTo(width, 6)
    }
  })

  it('벽감과 매달린 이름표가 진열장 자리 높이를 넘지 않는다', () => {
    for (const height of [420, 510, 610, 790, 1000]) {
      const { caseHeight, hang } = shelfMetrics(1440, height)
      expect(caseHeight + hang).toBeLessThanOrEqual(height)
    }
  })

  /** 1920 x 1080 부터 휴대폰까지의 진열장 자리 — [폭, 높이, 가리지 않는 폭] */
  const AREAS = [
    [1800, 800, 1440],
    [1800, 670, 1491],
    [1560, 670, 1251],
    [1340, 620, 1031],
    [1340, 500, 1031],
    [1266, 460, 957],
    [944, 488, 635],
    [708, 553, 708],
    [372, 380, 372],
    [350, 380, 350],
    [280, 380, 280],
  ] as const

  it('이름표 자리 때문에 병이 작아져도 칸 폭이 110 아래로 좁아지지 않는다 — 현판과 태그가 칸에 든다', () => {
    // 412 · 430 · 540 · 560 · 600 휴대폰의 벽 자리(쌓는 배치)
    const phones = [
      [372, 380],
      [390, 380],
      [500, 389],
      [520, 403],
      [560, 432],
    ] as const
    for (const [width, height] of phones) {
      expect(shelfMetrics(width, height).pitch).toBeGreaterThanOrEqual(110)
    }
    // 412 는 칸이 늘지 않고 칸 셋 · 칸 폭 124 입니다
    expect(shelfMetrics(372, 380)).toMatchObject({ visible: 3, pitch: 124 })
  })

  it('창이 칸 셋에도 모자라는 아주 좁은 휴대폰(320)에서는 칸 셋이 먼저다', () => {
    expect(shelfMetrics(280, 380).visible).toBe(3)
  })

  it('이름표 자리는 줄 + 태그 높이 + 그림자 여유 15 이고, 태그는 칸 폭보다 10px 이상 좁다', () => {
    for (const [width, height, clearWidth] of AREAS) {
      const { cord, tagWidth, tagHeight, hang, pitch, caseHeight } =
        shelfMetrics(width, height, clearWidth)
      expect(cord + tagHeight + 15).toBe(hang)
      expect(tagWidth).toBeLessThanOrEqual(pitch - 10)
      expect(caseHeight + hang).toBeLessThanOrEqual(height)
    }
  })

  it('이름표 치수는 끝자리가 0 또는 5 다', () => {
    for (const [width, height, clearWidth] of AREAS) {
      const { cord, tagWidth, tagHeight, hang } = shelfMetrics(
        width,
        height,
        clearWidth,
      )
      for (const value of [cord, tagWidth, tagHeight, hang]) {
        expect(value % 5).toBe(0)
      }
    }
  })

  it('벽감이 낮아지면 태그와 줄도 따라 작아진다', () => {
    const tall = shelfMetrics(1800, 800, 1440)
    const short = shelfMetrics(944, 488, 635)
    expect(short.tagWidth).toBeLessThan(tall.tagWidth)
    expect(short.tagHeight).toBeLessThan(tall.tagHeight)
    expect(short.cord).toBeLessThan(tall.cord)
  })

  it('이름표 자리는 진열장 자리의 절반을 넘지 않고, 넘치는 태그는 그 안으로 줄인다', () => {
    // 가로로 아주 긴 창. 칸 폭이 창 폭에 걸려 태그가 벽감보다 크게 셈해집니다
    const { caseHeight, cord, tagWidth, tagHeight, hang, pitch } = shelfMetrics(
      1800,
      200,
    )
    expect(hang).toBe(100)
    expect(cord + tagHeight + 15).toBe(hang)
    expect(tagWidth).toBeLessThan(pitch * 0.75)
    expect(caseHeight + hang).toBeLessThanOrEqual(200)
  })

  it('커진 병(1.06 배)이 천장에 닿지 않는다', () => {
    for (const height of [420, 610, 790]) {
      const { bottle, caseHeight } = shelfMetrics(1440, height)
      expect(38 + bottle * 1.06).toBeLessThan(caseHeight)
    }
  })

  it('병 · 벽감 높이는 끝자리가 0 또는 5 다', () => {
    const { bottle, caseHeight } = shelfMetrics(1020, 610)
    expect(bottle % 5).toBe(0)
    expect(caseHeight % 5).toBe(0)
  })
})

describe('shelfLayout', () => {
  it('1920 x 1080 의 진열장 자리(1800 x 800)에서 패널 362 왼쪽 끝(1438)까지 칸 여덟을 나누고, 이름표 아랫선보다 한 단 짧게 끊는다', () => {
    const layout = shelfLayout(1800, 800)
    expect(layout.panelWidth).toBe(362)
    /*
      패널과 벽감은 서로를 정합니다 — 패널이 넓어지면 가리지 않는 폭이 좁아지고,
      벽감은 그 폭으로 세므로 낮아지고, 배율은 벽감으로 정합니다. 그래서 규격 화면에서도
      배율이 딱 1 이 아닙니다: PANEL_WIDTH 365 가 벽감 600 을 만들고(시안 605 보다 5 낮음)
      600/605 = 0.992 로 362 에 섭니다. PANEL_WIDTH 를 만지면 이 세 값이 같이 움직입니다.
    */
    expect(layout.panelScale).toBeCloseTo(600 / 605, 9)
    expect(layout.clear).toBe(8)
    expect(layout.pitch).toBeCloseTo(1438 / 8, 9)
    expect(layout.visible).toBe(11)
    expect(layout.whole).toBe(10)
    expect(layout.clearWidth).toBeCloseTo(1438, 6)
    expect(layout.caseHeight).toBe(600)
    expect(layout.bottle).toBe(360)
    expect(layout.hang).toBe(135)
    expect([layout.tagWidth, layout.tagHeight]).toEqual([135, 85])
    // 벽감 600 + 이름표 135 에서 PANEL_TRIM 15 를 덜어냅니다
    expect(layout.panelHeight).toBe(720)
    expect(layout.plaqueSpan).toBe(2)
  })

  it('화면이 작아지면 패널이 벽감 높이를 따라 줄어든다', () => {
    // 1920 x 950 의 1800 x 670 자리 — 벽감이 605 아래로 내려옵니다
    const { panelScale, panelWidth, panelHeight, caseHeight, hang } =
      shelfLayout(1800, 670)
    expect(panelScale).toBeLessThan(1)
    expect(panelScale).toBeGreaterThan(0.85)
    expect(panelScale).toBeCloseTo(caseHeight / 605, 6)
    expect(Math.abs(panelWidth - 365 * panelScale)).toBeLessThanOrEqual(1)
    expect(panelHeight).toBe(caseHeight + hang - 15)
  })

  it('글자가 읽히는 하한(0.85 배) 아래로는 줄지 않는다', () => {
    // 1440 x 780 · 1280 x 720 의 진열장 자리 — 벽감이 605 의 0.85 배보다 낮습니다
    const areas = [
      [1340, 500],
      [1180, 440],
    ] as const
    for (const [width, height] of areas) {
      const { panelScale, panelWidth, panelHeight, caseHeight, hang } =
        shelfLayout(width, height)
      expect(panelScale).toBe(0.85)
      expect(panelWidth).toBe(310)
      expect(panelHeight).toBe(caseHeight + hang - 15)
      expect(panelHeight).toBeLessThanOrEqual(height)
    }
  })

  it('패널을 얹지 않는 배치에서는 창 전체가 가리지 않는 자리다', () => {
    const layout = shelfLayout(708, 530, { panel: false })
    expect(layout.panelWidth).toBe(0)
    expect(layout.clearWidth).toBe(708)
    expect(layout.clear).toBe(layout.visible)
    expect(layout.whole).toBe(layout.visible)
  })

  /** 한 장 배치의 진열장 자리 — [폭, 높이, 가리지 않는 칸] (1562 · 1645 · 1920 x 937 · 1440 · 1280 · 1280 스크롤 막대 · 1024) */
  const OVERLAY = [
    [1442, 634, 8],
    [1525, 634, 8],
    [1800, 657, 9],
    [1340, 620, 8],
    [1180, 460, 7],
    [1165, 460, 7],
    [944, 488, 5],
  ] as const

  it('패널 왼쪽 끝이 칸 경계에 선다 — 칸 폭은 바라는 폭(병 x 0.55)을 넘지 않고 110 아래로 내려가지 않는다 — 둘이 부딪히면 110 이 먼저다', () => {
    for (const [width, height, expected] of OVERLAY) {
      const { clear, pitch, bottle, panelWidth, clearWidth, visible, whole } =
        shelfLayout(width, height)
      expect(clear).toBe(expected)
      expect(Math.abs(clear * pitch - (width - panelWidth))).toBeLessThan(1e-6)
      expect(Math.abs(clearWidth - (width - panelWidth))).toBeLessThan(1e-6)
      // 바라는 폭보다 좁게 나누되, 그러면 110 아래로 내려가는 화면(1280 에 스크롤 막대)은 칸을 하나 덜 셉니다
      const edge = width - panelWidth
      expect(pitch).toBeLessThanOrEqual(
        Math.max(bottle * 0.55, edge / Math.floor(edge / 110)) + 1e-9,
      )
      expect(pitch).toBeGreaterThanOrEqual(110)
      expect(clear).toBeGreaterThanOrEqual(5)
      // 창에 걸치는 칸은 창을 다 덮고, 온전한 칸은 창 안에 듭니다
      expect(visible * pitch).toBeGreaterThanOrEqual(width - 1e-6)
      expect(whole * pitch).toBeLessThanOrEqual(width + 1e-6)
      expect(visible - whole).toBeLessThanOrEqual(1)
    }
  })

  it('두 칸 기둥은 가리지 않는 칸이 다섯 이상일 때만 — 쌓는 배치의 768 도 칸이 다섯이라 두 칸, 휴대폰은 한 칸이다', () => {
    for (const [width, height] of OVERLAY) {
      expect(shelfLayout(width, height).plaqueSpan).toBe(2)
    }
    expect(shelfLayout(708, 553, { panel: false })).toMatchObject({
      visible: 5,
      clear: 5,
      plaqueSpan: 2,
    })
    expect(shelfLayout(708, 553, { panel: false }).pitch).toBeCloseTo(141.6, 6)
    expect(shelfLayout(350, 380, { panel: false })).toMatchObject({
      visible: 3,
      clear: 3,
      plaqueSpan: 1,
    })
    expect(shelfLayout(350, 380, { panel: false }).pitch).toBeCloseTo(
      350 / 3,
      6,
    )
  })

  it('규격보다 큰 화면에서도 패널은 시안보다 커지지 않는다', () => {
    const { panelScale, panelWidth } = shelfLayout(1800, 1160)
    // 배율의 천장은 1 입니다 — 화면이 아무리 커도 패널이 시안보다 커지지 않습니다
    expect(panelScale).toBeLessThanOrEqual(1)
    // 규격(1800 x 800)과 같은 값 — 높이가 남아돌아도 더 자라지 않습니다
    expect(panelWidth).toBe(shelfLayout(1800, 800).panelWidth)
    expect(panelWidth).toBe(362)
  })
})

/** 이름만 다른 향수 n 개 */
const bottles = (n: number, category: ShelfItem['category']): ShelfItem[] =>
  Array.from({ length: n }, (_, at) => ({
    shelfItemId: at,
    perfumeId: at,
    name: `향수 ${at}`,
    brand: '브랜드',
    thumbnailUrl: null,
    category,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  }))

const WISH: ShelfSection = {
  category: 'WISH',
  label: '보유 희망',
  items: bottles(3, 'WISH'),
}

const SECTIONS: ShelfSection[] = [
  { category: 'OWNED', label: '보유 중', items: bottles(5, 'OWNED') },
  { category: 'TRIED', label: '시향해 봄', items: bottles(17, 'TRIED') },
  WISH,
]

/** 병 수만 정한 세 분류 */
const sized = ([owned, tried, wish]: readonly number[]): ShelfSection[] => [
  {
    category: 'OWNED',
    label: '보유 중',
    items: bottles(owned ?? 0, 'OWNED'),
  },
  {
    category: 'TRIED',
    label: '시향해 봄',
    items: bottles(tried ?? 0, 'TRIED'),
  },
  { category: 'WISH', label: '보유 희망', items: bottles(wish ?? 0, 'WISH') },
]

/** ShelfWall 과 같은 셈 — 창 왼쪽 끝이 설 수 있는 마지막 칸 */
const maxOf = (layout: WallLayout, clear: number) =>
  Math.max(0, layout.total - clear, layout.sections.at(-1)?.plaque ?? 0)

describe('layoutWall', () => {
  it('분류마다 이름표 벽 한 칸 뒤에 벽감을 붙이고, 맨 끝에 처음으로 기둥을 둔다', () => {
    const { sections, back, total } = layoutWall(SECTIONS)
    expect(
      sections.map(({ plaque, start, span }) => [plaque, start, span]),
    ).toEqual([
      [0, 1, 5],
      [6, 7, 17],
      [24, 25, 3],
    ])
    expect(back).toBe(28)
    expect(total).toBe(29)
  })

  it('빈 분류도 "비어 있음" 을 적을 한 칸을 차지한다', () => {
    const { sections } = layoutWall([
      { category: 'OWNED', label: '보유 중', items: [] },
      WISH,
    ])
    expect(sections[0]?.span).toBe(1)
    expect(sections[1]?.plaque).toBe(2)
  })

  it('두 칸 기둥 — 가리지 않는 칸 일곱(1280 x 720 에 스크롤 막대)에서 병 [5, 17, 3] 은 빈 벽 없이 이어지고 처음으로 기둥이 31 에 선다', () => {
    const layout = layoutWall(SECTIONS, 7, 2)
    expect(
      layout.sections.map(({ plaque, start, gap }) => [plaque, start, gap]),
    ).toEqual([
      [0, 2, 0],
      [7, 9, 0],
      [26, 28, 0],
    ])
    expect(layout).toMatchObject({ back: 31, total: 33, plaqueSpan: 2 })
    // 벽 끝(26)에서 처음으로 기둥이 패널 바로 왼쪽 두 칸(5 · 6번째 칸)에 섭니다
    expect(maxOf(layout, 7)).toBe(26)
    expect(layout.back - maxOf(layout, 7)).toBe(7 - 2)
  })

  it('가리지 않는 칸 여덟(1920 x 937)이면 기둥이 패널 경계에 반쯤 걸리지 않게 한 칸을 비운다', () => {
    const layout = layoutWall(SECTIONS, 8, 2)
    expect(layout.sections.map(({ plaque, gap }) => [plaque, gap])).toEqual([
      [0, 1],
      [8, 0],
      [27, 1],
    ])
    expect(layout).toMatchObject({ back: 33, total: 35 })
  })

  it('병이 적은 분류의 첫머리에 서면 다음 기둥이 패널 바로 왼쪽에 붙는다', () => {
    // 가리지 않는 칸 일곱 · 병 [2, 17, 1] — 이름표 두 칸 · 병 둘 · 빈 벽 · 다음 이름표 두 칸
    const layout = layoutWall(sized([2, 17, 1]), 7, 2)
    expect(layout.sections.map(({ gap }) => gap)).toEqual([1, 0, 2])
    expect(layout.sections[1]?.plaque).toBe(0 + 7 - 2)
    expect(layout.back).toBe((layout.sections[2]?.plaque ?? 0) + 7 - 2)
  })

  it('한 칸 기둥 — 병이 적은 분류의 첫머리에 서면 다음 분류의 이름표가 가리지 않는 자리의 마지막 칸에 걸린다', () => {
    // 가리지 않는 칸 여섯. 병 둘 → 빈 벽 둘, 병 하나 → 빈 벽 셋, 마지막 병 셋 → 빈 벽 하나(처음으로 기둥)
    const { sections, back, total } = layoutWall(
      [
        { category: 'OWNED', label: '보유 중', items: bottles(2, 'OWNED') },
        { category: 'TRIED', label: '시향해 봄', items: bottles(1, 'TRIED') },
        WISH,
      ],
      6,
    )
    expect(sections.map(({ plaque, gap }) => [plaque, gap])).toEqual([
      [0, 2],
      [5, 3],
      [10, 1],
    ])
    expect(back).toBe(15)
    expect(total).toBe(16)
    const columns = [...sections.map(({ plaque }) => plaque), back]
    for (let at = 1; at < columns.length; at += 1) {
      expect(columns[at]).toBe((columns[at - 1] ?? 0) + 6 - 1)
    }
  })

  it('가리지 않는 자리를 딱 채우는 분류와 넘치는 분류 뒤에는 빈 벽을 두지 않는다', () => {
    // 병 넷이면 이름표 1 + 병 4 = 5칸이라 다음 이름표가 바로 여섯째 칸에 걸립니다
    const { sections } = layoutWall(sized([4, 17, 3]), 6)
    expect(sections.map(({ plaque, gap }) => [plaque, gap])).toEqual([
      [0, 0],
      [5, 0],
      [23, 1],
    ])
  })

  it('빈 분류는 "비어 있음" 한 칸 뒤에 빈 벽을 둔다', () => {
    const { sections } = layoutWall(
      [{ category: 'OWNED', label: '보유 중', items: [] }, WISH],
      6,
    )
    expect(sections[0]?.gap).toBe(3)
    expect(sections[1]?.plaque).toBe(5)
  })

  it('마지막 분류 뒤도 같은 셈이라, 병이 적으면 처음으로 기둥이 가리지 않는 자리 끝에 선다', () => {
    const { sections, back, total } = layoutWall(
      [{ category: 'WISH', label: '보유 희망', items: bottles(1, 'WISH') }],
      6,
    )
    expect(sections[0]?.gap).toBe(3)
    expect(back).toBe(5)
    expect(total).toBe(6)
  })

  it('한 칸 기둥 — 가리지 않는 칸 셋(390)에서 병 [5, 17, 3] 은 이름표 0 · 6 · 24, 처음으로 28 이다', () => {
    const layout = layoutWall(SECTIONS, 3, 1)
    expect(layout.sections.map(({ plaque }) => plaque)).toEqual([0, 6, 24])
    expect(layout).toMatchObject({ back: 28, total: 29, plaqueSpan: 1 })
    expect(maxOf(layout, 3)).toBe(26)
  })

  it('가리지 않는 칸이 셋뿐인 휴대폰 폭에서는 빈 벽이 생기지 않는다', () => {
    const { sections } = layoutWall(
      [
        { category: 'OWNED', label: '보유 중', items: bottles(1, 'OWNED') },
        { category: 'TRIED', label: '시향해 봄', items: [] },
        WISH,
      ],
      3,
    )
    expect(sections.map(({ gap }) => gap)).toEqual([0, 0, 0])
  })
})

describe('wallStops', () => {
  it('가리지 않는 칸 일곱 · 병 [5, 17, 3] — 기둥 가운데를 창 왼쪽 끝이나 패널 경계가 가르는 1 · 8 · 20 · 25 에는 멈추지 않는다', () => {
    const layout = layoutWall(SECTIONS, 7, 2)
    const max = maxOf(layout, 7)
    const stops = wallStops(layout, 7, max)
    const blocked = Array.from({ length: max + 1 }, (_, at) => at).filter(
      (at) => !stops.includes(at),
    )
    expect(blocked).toEqual([1, 8, 20, 25])
  })

  it('가리지 않는 칸 다섯(1024 · 768) — 1 · 3 · 8 · 22 · 27 이 막히고 벽 끝은 28 이다', () => {
    const layout = layoutWall(SECTIONS, 5, 2)
    const max = maxOf(layout, 5)
    expect(max).toBe(28)
    const stops = wallStops(layout, 5, max)
    expect(
      Array.from({ length: max + 1 }, (_, at) => at).filter(
        (at) => !stops.includes(at),
      ),
    ).toEqual([1, 3, 8, 22, 27])
  })

  it('한 칸 기둥이면 막힌 자리가 없다', () => {
    const layout = layoutWall(SECTIONS, 3, 1)
    const max = maxOf(layout, 3)
    expect(wallStops(layout, 3, max)).toEqual(
      Array.from({ length: max + 1 }, (_, at) => at),
    )
  })

  it('어떤 병 수에서도 벽 끝 · 분류 현판에는 멈추고, 멈춘 자리에서 기둥이 창 경계에 잘리지 않는다', () => {
    const K = 2
    for (let clear = 5; clear <= 9; clear += 1) {
      for (let owned = 0; owned <= 8; owned += 1) {
        for (let tried = 0; tried <= 8; tried += 1) {
          for (let wish = 0; wish <= 8; wish += 1) {
            const layout = layoutWall(sized([owned, tried, wish]), clear, K)
            const max = maxOf(layout, clear)
            const stops = wallStops(layout, clear, max)
            const columns = [
              ...layout.sections.map(({ plaque }) => plaque),
              layout.back,
            ]
            expect(stops).toContain(0)
            expect(stops).toContain(max)
            for (const { plaque } of layout.sections) {
              expect(stops).toContain(plaque)
            }
            for (const stop of stops) {
              for (const column of columns) {
                const cutsLeft = column < stop && stop < column + K
                const edge = stop + clear
                const cutsEdge = column < edge && edge < column + K
                expect(cutsLeft || cutsEdge).toBe(false)
              }
            }
            // 짧은 분류의 다음 기둥은 패널 바로 왼쪽, 벽 끝의 처음으로 기둥도 패널 바로 왼쪽
            layout.sections.forEach(({ plaque, span }, at) => {
              if (K + span + K > clear) return
              const next = layout.sections[at + 1]?.plaque ?? layout.back
              expect(next).toBe(plaque + clear - K)
            })
            expect(layout.back - max).toBe(clear - K)
          }
        }
      }
    }
  })
})

describe('nextStop · nearStop', () => {
  const layout = layoutWall(SECTIONS, 7, 2)
  const stops = wallStops(layout, 7, maxOf(layout, 7))

  it('가던 쪽으로 처음 만나는 멈출 자리 — 자기 자신도 포함한다', () => {
    expect(nextStop(stops, 1, 1)).toBe(2)
    expect(nextStop(stops, 8, 1)).toBe(9)
    expect(nextStop(stops, 8, -1)).toBe(7)
    expect(nextStop(stops, 7, 1)).toBe(7)
  })

  it('벽 끝을 넘어가지 않는다', () => {
    expect(nextStop(stops, -3, -1)).toBe(0)
    expect(nextStop(stops, 40, 1)).toBe(26)
  })

  it('멈출 수 있는 자리면 그대로, 막힌 자리면 가던 쪽으로 비켜선다', () => {
    expect(nearStop(stops, 19, 1)).toBe(19)
    expect(nearStop(stops, 20, -1)).toBe(19)
    expect(nearStop(stops, 20, 1)).toBe(21)
  })
})

describe('slotView', () => {
  it('창 오른쪽 끝에 걸린 칸이 있으면 — 창 밖은 감추고, 왼쪽 이웃 하나와 걸린 칸 · 그다음 칸을 창 끝에 걸친 칸으로 친다', () => {
    // 창 왼쪽 끝 3 · 창에 걸치는 칸 아홉(3 ~ 11) · 온전한 칸 여덟(3 ~ 10)
    const view = (at: number) => slotView(at, 3, 12, 11)
    expect(view(2)).toEqual({ hidden: true, edge: true })
    expect(view(3)).toEqual({ hidden: false, edge: false })
    expect(view(10)).toEqual({ hidden: false, edge: false })
    expect(view(11)).toEqual({ hidden: false, edge: true })
    expect(view(12)).toEqual({ hidden: true, edge: true })
    expect(view(13)).toEqual({ hidden: true, edge: false })
    expect(view(1)).toEqual({ hidden: true, edge: false })
  })

  it('창 끝에 걸친 칸은 많아야 셋이다', () => {
    const count = (winFrom: number, winTo: number, edgeFrom: number) =>
      Array.from({ length: 40 }, (_, at) => at - 5).filter(
        (at) => slotView(at, winFrom, winTo, edgeFrom).edge,
      ).length
    expect(count(3, 12, 11)).toBe(3)
    // 걸린 칸이 없는 쌓는 배치(온전한 칸 = 창에 걸치는 칸)는 양옆 하나씩
    expect(count(3, 8, 8)).toBe(2)
    expect(count(0, 9, 8)).toBe(3)
  })

  it('벽감 기준으로 좁혀 준 창 경계(−2 ~ 칸 수 + 1)도 벽 기준과 같은 처지를 준다', () => {
    const span = 5
    const bound = (value: number) => Math.min(span + 1, Math.max(-2, value))
    for (const sectionStart of [0, 7, 26]) {
      for (let start = 0; start <= 30; start += 1) {
        for (const at of [0, 1, 2, 3, 4]) {
          const wall = slotView(sectionStart + at, start, start + 9, start + 8)
          const local = slotView(
            at,
            bound(start - sectionStart),
            bound(start + 9 - sectionStart),
            bound(start + 8 - sectionStart),
          )
          expect(local).toEqual(wall)
        }
      }
    }
  })
})

describe('sectionAt', () => {
  const { sections } = layoutWall(SECTIONS)

  it('이름표 벽은 뒤따르는 벽감의 분류로 친다', () => {
    expect(sectionAt(sections, 6.2)?.category).toBe('TRIED')
  })

  it('벽감 한가운데는 그 분류다', () => {
    expect(sectionAt(sections, 3.5)?.category).toBe('OWNED')
    expect(sectionAt(sections, 26)?.category).toBe('WISH')
  })
})

describe('snapStart', () => {
  it('끌다 뗀 쪽으로 다음 병이 조금만 들어와도 그 병을 마저 들인다', () => {
    expect(snapStart(2.2, 1, 24)).toBe(3)
    expect(snapStart(2.8, -1, 24)).toBe(2)
  })

  it('경계를 살짝 넘긴 정도면 제자리로 돌아간다', () => {
    expect(snapStart(2.05, 1, 24)).toBe(2)
    expect(snapStart(2.95, -1, 24)).toBe(3)
  })

  it('방향이 없으면 가까운 경계로 붙는다', () => {
    expect(snapStart(2.4, 0, 24)).toBe(2)
    expect(snapStart(2.6, 0, 24)).toBe(3)
  })

  it('벽 양 끝을 넘어가지 않는다', () => {
    expect(snapStart(-0.5, -1, 24)).toBe(0)
    expect(snapStart(24.5, 1, 24)).toBe(24)
  })
})

describe('meterWheel', () => {
  /** 휠 이벤트를 차례로 넣고 칸을 모두 더합니다(칸 폭 176.6 — 모으는 몫 88.3px) */
  const feed = (
    events: readonly { delta: number; time: number; deltaMode?: number }[],
    pitch = 176.6,
  ) => {
    let meter: WheelMeter = WHEEL_IDLE
    let total = 0
    for (const { delta, time, deltaMode = 0 } of events) {
      const counted = meterWheel(meter, { delta, deltaMode, time, pitch })
      meter = counted.meter
      total += counted.step
    }
    return { total, meter }
  }

  /** 같은 값이 일정한 간격(ms)으로 오는 흐름 */
  const stream = (count: number, delta: number, every: number) =>
    Array.from({ length: count }, (_, at) => ({
      delta,
      time: 1000 + at * every,
    }))

  it('마우스 휠 한 번은 값(배율 · 확대)과 상관없이 한 칸이다', () => {
    for (const delta of [100, 120, 66.67, 150]) {
      expect(feed([{ delta, time: 0 }]).total).toBe(1)
    }
    expect(feed([{ delta: -150, time: 0 }]).total).toBe(-1)
  })

  it('줄 단위 휠(파이어폭스 3줄)도 한 칸이다', () => {
    expect(feed([{ delta: 3, time: 0, deltaMode: 1 }]).total).toBe(1)
  })

  it('빠르게 다섯 번(30ms 간격) 굴리면 다섯 칸이다', () => {
    expect(feed(stream(5, 100, 30)).total).toBe(5)
  })

  it('드문드문 오는 작은 한 번(맥 마우스 4px, 80ms 간격)도 한 번에 한 칸이다', () => {
    expect(feed(stream(5, 4, 80)).total).toBe(5)
  })

  it('트랙패드 흐름(4px 씩 16ms 간격 40번)은 첫 이벤트 한 칸 + 모은 156px 이 88px 을 넘어 한 칸', () => {
    expect(feed(stream(40, 4, 16)).total).toBe(2)
    // 첫 이벤트가 3px 이 안 되면 모아서만 셉니다 — 150px 에 한 칸
    expect(feed(stream(100, 1.5, 16)).total).toBe(1)
  })

  it('모으는 몫은 칸 폭의 절반이되 60 ~ 120px 사이다', () => {
    // 칸 폭 100 → 60px 마다, 칸 폭 300 → 120px 마다
    expect(feed(stream(100, 1.5, 16), 100).total).toBe(2)
    expect(feed(stream(100, 1.5, 16), 300).total).toBe(1)
    expect(feed(stream(160, 1.5, 16), 300).total).toBe(2)
  })

  it('방향이 바뀌면 모아 둔 것을 버린다', () => {
    const { meter } = feed(stream(50, 1.5, 16))
    expect(meter.pending).toBe(75)
    expect(
      meterWheel(meter, { delta: -2, deltaMode: 0, time: 1800, pitch: 176.6 }),
    ).toEqual({ step: 0, meter: { pending: -2, lastAt: 1800 } })
  })

  it('250ms 조용하면 모아 둔 것을 버린다', () => {
    const { meter } = feed(stream(50, 1.5, 16))
    const later = meterWheel(meter, {
      delta: 1.5,
      deltaMode: 0,
      time: meter.lastAt + 250,
      pitch: 176.6,
    })
    expect(later.meter.pending).toBe(1.5)
  })

  it('이벤트 하나가 두 칸 이상이 되지 않는다', () => {
    const huge = meterWheel(WHEEL_IDLE, {
      delta: 5000,
      deltaMode: 0,
      time: 0,
      pitch: 176.6,
    })
    expect(huge.step).toBe(1)
    // 모인 몫이 두 칸 넘게 있어도 한 칸만 가고 나머지는 남깁니다(칸 폭 120 — 모으는 몫 60)
    expect(
      meterWheel(
        { pending: 200, lastAt: 0 },
        { delta: 2, deltaMode: 0, time: 10, pitch: 120 },
      ),
    ).toEqual({ step: 1, meter: { pending: 142, lastAt: 10 } })

    let meter: WheelMeter = WHEEL_IDLE
    let seed = 7
    for (let at = 0; at < 2000; at += 1) {
      seed = (seed * 16807) % 2147483647
      const counted = meterWheel(meter, {
        delta: ((seed % 400) - 200) / 4,
        deltaMode: 0,
        time: at * 8,
        pitch: 150,
      })
      expect(Math.abs(counted.step)).toBeLessThanOrEqual(1)
      meter = counted.meter
    }
  })
})

describe('wheelStop', () => {
  // 가리지 않는 칸 일곱 · 병 [5, 17, 3] — 1 · 8 · 20 · 25 가 막히고 벽 끝은 26
  const layout = layoutWall(SECTIONS, 7, 2)
  const stops = wallStops(layout, 7, maxOf(layout, 7))
  const still = (at: number) => ({ position: at, dest: at, moving: false })

  it('서 있으면 한 번에 한 칸 — 기둥이 창 경계에 잘리는 막힌 자리는 건너뛴다', () => {
    expect(wheelStop(stops, still(0), 1)).toBe(2)
    expect(wheelStop(stops, still(3), 1)).toBe(4)
    expect(wheelStop(stops, still(7), 1)).toBe(9)
    expect(wheelStop(stops, still(7), -1)).toBe(6)
    expect(wheelStop(stops, still(21), -1)).toBe(19)
  })

  it('벽 끝에서 더 굴리면 목적지가 그대로다', () => {
    expect(wheelStop(stops, still(0), -1)).toBe(0)
    expect(wheelStop(stops, still(26), 1)).toBe(26)
  })

  it('같은 쪽으로 흐르는 중이면 목적지에서 한 칸씩 쌓인다', () => {
    expect(wheelStop(stops, { position: 0.4, dest: 2, moving: true }, 1)).toBe(
      3,
    )
    expect(wheelStop(stops, { position: 4.2, dest: 7, moving: true }, 1)).toBe(
      9,
    )
  })

  it('반대로 굴리면 지금 자리에서 그쪽 다음 칸 경계로 돌아선다', () => {
    expect(wheelStop(stops, { position: 3.8, dest: 6, moving: true }, -1)).toBe(
      3,
    )
    expect(wheelStop(stops, { position: 5.3, dest: 3, moving: true }, 1)).toBe(
      6,
    )
  })

  it('목적지에 거의 닿았으면(0.02 칸 안) 서 있는 것처럼 센다', () => {
    const near = { position: 2.99, dest: 3, moving: true }
    expect(wheelStop(stops, near, 1)).toBe(4)
    expect(wheelStop(stops, near, -1)).toBe(2)
    expect(wheelStop(stops, { position: 3.01, dest: 3, moving: true }, 1)).toBe(
      4,
    )
  })

  it('0 에서 다섯 번 연달아 굴리면 막힌 자리를 뺀 다섯 칸(2 ~ 6)을 간다', () => {
    let dest = 0
    for (let at = 0; at < 5; at += 1) {
      dest = wheelStop(stops, { position: 0, dest, moving: at > 0 }, 1)
    }
    expect(dest).toBe(6)
  })
})

describe('revealStart', () => {
  it('보이는 칸이면 창을 움직이지 않는다', () => {
    expect(revealStart(3, 5, 5, 24)).toBe(3)
  })

  it('오른쪽 밖이면 그 칸이 창 오른쪽 끝에 오도록 최소한만 민다', () => {
    expect(revealStart(3, 5, 9, 24)).toBe(5)
  })

  it('왼쪽 밖이면 앞의 이름표 벽까지 보이도록 당긴다', () => {
    expect(revealStart(10, 5, 7, 24, 1)).toBe(6)
  })

  it('벽 끝을 넘어가지 않는다', () => {
    expect(revealStart(0, 5, 28, 24)).toBe(24)
    expect(revealStart(3, 5, 0, 24, 1)).toBe(0)
  })
})

describe('revealItem', () => {
  /** 한 칸 기둥이라 막힌 자리가 없는 벽의 멈출 자리 */
  const everyStop = (max: number) =>
    Array.from({ length: max + 1 }, (_, at) => at)

  // 가리지 않는 칸 여섯 · 한 칸 기둥. 병 둘 · 하나 · 셋 → 이름표 0 · 5 · 10, 처음으로 15, 창 끝 10
  const SHORT = layoutWall(sized([2, 1, 3]), 6).sections
  const SHORT_STOPS = everyStop(10)
  // 병 다섯 · 열일곱 · 셋 → 이름표 0 · 6 · 24, 처음으로 29, 창 끝 24
  const LONG = layoutWall(SECTIONS, 6).sections
  const LONG_STOPS = everyStop(24)

  /** 창 왼쪽 끝(start)에서 가리지 않는 자리에 병이 서는 분류들 */
  const bottlesIn = (sections: typeof SHORT, start: number) =>
    new Set(
      sections
        .filter(({ start: first, items }) =>
          items.some((_, at) => first + at >= start && first + at < start + 6),
        )
        .map(({ category }) => category),
    )

  it('이미 가리지 않는 자리에 있으면 움직이지 않는다', () => {
    expect(revealItem(SHORT, 0, 6, 2, 10, SHORT_STOPS)).toBe(0)
    expect(revealItem(LONG, 3, 6, 7, 24, LONG_STOPS)).toBe(3)
  })

  it('짧은 분류에서 다음 분류의 첫 병으로 넘어가면 그 분류의 첫머리에 선다 — 두 분류의 병이 섞이지 않는다', () => {
    // 최소한만 옮기면 1 — 보유 중 병 둘과 시향해 봄 첫 병이 함께 섭니다
    expect(bottlesIn(SHORT, revealStart(0, 6, 6, 10, 1)).size).toBe(2)

    const next = revealItem(SHORT, 0, 6, 6, 10, SHORT_STOPS)
    expect(next).toBe(5)
    expect([...bottlesIn(SHORT, next)]).toEqual(['TRIED'])
    // 칩도 고른 병의 분류에 켜집니다
    expect(sectionAt(SHORT, next + 3)?.category).toBe('TRIED')
  })

  it('앞 분류로 돌아가면 그 분류의 병만 서는 자리로 간다', () => {
    // 시향해 봄 첫머리(5)에서 보유 중 끝 병(2)으로
    const back = revealItem(SHORT, 5, 6, 2, 10, SHORT_STOPS)
    expect(back).toBe(0)
    expect([...bottlesIn(SHORT, back)]).toEqual(['OWNED'])
    expect(sectionAt(SHORT, back + 3)?.category).toBe('OWNED')
  })

  it('긴 분류로 넘어가면 병을 오른쪽 끝에 두되, 창 왼쪽 끝이 그 분류의 이름표보다 앞으로 나가지 않는다', () => {
    // 보유 희망 첫머리(24)에서 시향해 봄 끝 병(23)으로 · 시향해 봄 첫머리(6)에서 보유 중 끝 병(5)으로
    expect(revealItem(LONG, 24, 6, 23, 24, LONG_STOPS)).toBe(18)
    expect(revealItem(LONG, 6, 6, 5, 24, LONG_STOPS)).toBe(0)
    // 보유 중 첫머리(0)에서 시향해 봄 첫 병(7)으로
    expect(revealItem(LONG, 0, 6, 7, 24, LONG_STOPS)).toBe(6)
    for (const start of [18, 0, 6]) {
      expect(bottlesIn(LONG, start).size).toBe(1)
    }
  })

  it('보던 분류 안에서 왼쪽으로는 최소한만 옮기고, 첫 병이면 이름표 벽까지 보인다', () => {
    expect(revealItem(LONG, 10, 6, 9, 24, LONG_STOPS)).toBe(9)
    expect(revealItem(LONG, 10, 6, 7, 24, LONG_STOPS)).toBe(6)
    // 오른쪽으로는 그 병이 가리지 않는 자리의 오른쪽 끝에 옵니다
    expect(revealItem(LONG, 6, 6, 12, 24, LONG_STOPS)).toBe(7)
  })

  describe('두 칸 기둥(가리지 않는 칸 일곱 · 병 [5, 17, 3])', () => {
    const layout = layoutWall(SECTIONS, 7, 2)
    const max = maxOf(layout, 7)
    const stops = wallStops(layout, 7, max)
    const reveal = (from: number, index: number) =>
      revealItem(layout.sections, from, 7, index, max, stops)

    it('다른 분류로 넘어가면 그 분류의 현판 기둥이 창 왼쪽 끝에 선다', () => {
      // 보유 중 첫머리에서 시향해 봄 첫 병(9)으로 · 시향해 봄 첫머리에서 보유 중 첫 병(2)으로
      expect(reveal(0, 9)).toBe(7)
      expect(reveal(7, 2)).toBe(0)
      // 보유 희망 첫머리(26)에서 시향해 봄 끝 병(25)으로
      expect(reveal(26, 25)).toBe(19)
    })

    it('구한 자리가 막혀 있으면 가던 쪽으로 비켜서고, 고른 병은 가리지 않는 자리에 남는다', () => {
      // 시향해 봄 여섯째 병(14) — 최소한만 옮기면 8(기둥이 창 왼쪽 끝에 잘림)이라 9 에 섭니다
      expect(reveal(0, 14)).toBe(9)
      // 보던 분류 안에서 첫 병(9)으로 돌아가면 기둥 두 칸까지 보입니다
      expect(reveal(12, 9)).toBe(7)
    })

    it('어느 멈출 자리에서 어느 병을 골라도, 멈출 자리에 서고 그 병이 가리지 않는 자리에 든다', () => {
      for (let clear = 5; clear <= 9; clear += 1) {
        for (const sizes of [
          [5, 17, 3],
          [0, 1, 0],
          [1, 1, 1],
          [2, 17, 1],
          [3, 0, 6],
          [6, 6, 6],
          [7, 2, 8],
        ]) {
          const wall = layoutWall(sized(sizes), clear, 2)
          const end = maxOf(wall, clear)
          const allowed = wallStops(wall, clear, end)
          for (const from of allowed) {
            for (const { start, items } of wall.sections) {
              items.forEach((_, at) => {
                const index = start + at
                const next = revealItem(
                  wall.sections,
                  from,
                  clear,
                  index,
                  end,
                  allowed,
                )
                expect(allowed).toContain(next)
                expect(index).toBeGreaterThanOrEqual(next)
                expect(index).toBeLessThan(next + clear)
              })
            }
          }
        }
      }
    })
  })
})

describe('plaqueMetrics', () => {
  /** 1920 x 1080 부터 휴대폰까지의 진열장 자리 — [폭, 높이, 상세 패널을 얹는가] */
  const WALLS = [
    [1800, 800, true],
    [1800, 670, true],
    [1560, 670, true],
    [1340, 620, true],
    [1340, 500, true],
    [1266, 460, true],
    [944, 488, true],
    [708, 553, false],
    [350, 380, false],
  ] as const

  /** 이름표 벽 기둥 좌우를 이웃 벽감의 옆벽이 차지하는 폭(--track-inset 33 x 2) */
  const SIDES = 66

  /** 그 화면의 벽에 서는 현판과 기둥 폭 */
  const plaqueOf = (width: number, height: number, panel = true) => {
    const { pitch, caseHeight, plaqueSpan } = shelfLayout(width, height, {
      panel,
    })
    return {
      caseHeight,
      column: pitch * plaqueSpan,
      ...plaqueMetrics(pitch, caseHeight, plaqueSpan),
    }
  }

  it('1920 x 1080(칸 1460/7 · 벽감 605 · 두 칸 기둥)에서 현판은 175 x 455 이고 영문 설명까지 다 적는다', () => {
    const plaque = plaqueMetrics(1460 / 7, 605, 2)
    expect(plaque.width).toBe(175)
    expect(plaque.height).toBe(455)
    expect(plaque.detail).toBe('full')
    const { notch, arch, corner, inset, pin, crown, pinTop } = plaque
    expect({ notch, arch, corner, inset, pin, crown, pinTop }).toEqual({
      notch: 12,
      arch: 25,
      corner: 25,
      inset: 6,
      pin: 12,
      crown: 37,
      pinTop: 19,
    })
  })

  it('두 칸 기둥의 현판은 시안 비율(벽감의 29% x 75%)로 선다', () => {
    const cases = [
      [1460 / 7, 605, 2, 175, 455, 'full'], // 1920 x 1080
      [1236 / 7, 480, 2, 135, 360, 'full'], // 1645 x 914
      [1051 / 7, 445, 2, 125, 335, 'full'], // 1440 x 900
      [891 / 7, 345, 2, 100, 260, 'full'], // 1280 x 720
      [131, 355, 2, 100, 265, 'full'], // 1024 x 768
      [350 / 3, 275, 1, 40, 125, 'vertical'], // 390 — 한 칸 기둥
    ] as const
    for (const [pitch, caseHeight, span, width, height, detail] of cases) {
      expect(plaqueMetrics(pitch, caseHeight, span)).toMatchObject({
        width,
        height,
        detail,
      })
    }
  })

  it('한 장 배치의 모든 화면에서 현판은 다 적고, 옆벽과 25px 이상 떨어지며, 폭은 벽감의 29% 이하다', () => {
    // 병을 벽감의 60% 로 줄여 칸이 촘촘해진 뒤로 1440 x 900 은 36, 1280 x 720 은 28 입니다
    const areas = [
      [1800, 800],
      [1442, 634],
      [1525, 634],
      [1800, 657],
      [1340, 620],
      [1180, 460],
      [1165, 460],
      [944, 488],
    ] as const
    for (const [width, height] of areas) {
      const plaque = plaqueOf(width, height)
      expect(plaque.detail).toBe('full')
      expect((plaque.column - SIDES - plaque.width) / 2).toBeGreaterThanOrEqual(
        25,
      )
      expect(plaque.width).toBeLessThanOrEqual(plaque.caseHeight * 0.29)
      expect(plaque.width % 5).toBe(0)
      expect(plaque.height % 5).toBe(0)
    }
  })

  it('현판은 이웃 벽감의 옆벽에 닿지 않는다 — 좌우로 5px 이상 띄운다', () => {
    for (const [width, height, panel] of WALLS) {
      const plaque = plaqueOf(width, height, panel)
      expect((plaque.column - SIDES - plaque.width) / 2).toBeGreaterThanOrEqual(
        5,
      )
    }
  })

  it('높이는 벽감의 75% 와 폭의 3.2 배를 넘지 않고, 폭 · 높이는 끝자리가 0 또는 5 다', () => {
    for (const [width, height, panel] of WALLS) {
      const plaque = plaqueOf(width, height, panel)
      expect(plaque.height).toBeLessThanOrEqual(plaque.caseHeight * 0.75 + 2.5)
      expect(plaque.height).toBeLessThanOrEqual(plaque.width * 3.2)
      expect(plaque.width % 5).toBe(0)
      expect(plaque.height % 5).toBe(0)
    }
  })

  it('한 칸 기둥에서 폭이 좁아지면 영문 설명을 빼고, 더 좁으면 분류 이름을 세로로 세운다', () => {
    // 칸 169.44 · 벽감 470 — 맨 벽 103 이라 현판 90
    expect(plaqueMetrics(169.44, 470)).toMatchObject({
      width: 90,
      detail: 'compact',
    })
    // 칸 131 · 벽감 355 — 맨 벽 65 라 현판 55
    expect(plaqueMetrics(131, 355).detail).toBe('vertical')
    // 390
    expect(plaqueOf(350, 380, false)).toMatchObject({
      width: 40,
      height: 125,
      detail: 'vertical',
    })
  })

  it('맨 벽이 좁은 휴대폰에서도 현판은 옆벽에 겹치지 않고, 세로 이름이 핀 · 테두리선에 걸리지 않는 높이로 선다', () => {
    // 320 · 360 · 412 · 480 휴대폰의 벽 자리(쌓는 배치)
    const phones = [
      [280, 380],
      [320, 380],
      [372, 380],
      [440, 380],
    ] as const
    for (const [width, height] of phones) {
      const plaque = plaqueOf(width, height, false)
      expect(plaque.width).toBeLessThanOrEqual(plaque.column - SIDES)
      expect(plaque.detail).toBe('vertical')
      expect(plaque.height).toBeGreaterThanOrEqual(110)
      expect(plaque.height).toBeLessThanOrEqual(plaque.caseHeight * 0.75 + 2.5)
      expect(plaque.pinTop + plaque.pin).toBeLessThanOrEqual(plaque.crown)
    }
  })

  it('핀은 안쪽 테두리선 아래 · 어깨 위에 꽂힌다', () => {
    for (const [width, height, panel] of WALLS) {
      const { inset, pin, pinTop, crown } = plaqueOf(width, height, panel)
      expect(pinTop).toBeGreaterThan(inset + 1)
      expect(pinTop + pin).toBeLessThanOrEqual(crown)
    }
  })

  it('clip-path 값 — 종이는 윤곽 하나, 띠는 바깥 윤곽과 들인 윤곽을 evenodd 로 겹친다', () => {
    const plaque = plaqueMetrics(1460 / 7, 605, 2)
    expect(plaque.shape).toBe(`path("${plaquePath(plaque)}")`)
    expect(plaque.edgeRing).toBe(
      `path(evenodd, "${plaquePath(plaque)} ${plaquePath(plaque, 1)}")`,
    )
    expect(plaque.lineRing).toContain(plaquePath(plaque, plaque.inset))
  })
})

describe('plaquePath', () => {
  const plaque = plaqueMetrics(1460 / 7, 605, 2)

  /** 경로의 끝점들. M · V · H · A 마다 펜이 멈추는 자리입니다 */
  const endpoints = (path: string) => {
    const points: { x: number; y: number }[] = []
    let x = 0
    let y = 0
    for (const [, command, args = ''] of path.matchAll(
      /([MVHAZ])([^MVHAZ]*)/g,
    )) {
      const values = args.trim().split(/\s+/).map(Number)
      if (command === 'M') [x = 0, y = 0] = values
      if (command === 'V') [y = 0] = values
      if (command === 'H') [x = 0] = values
      if (command === 'A') [, , , , , x = 0, y = 0] = values
      if (command !== 'Z') points.push({ x, y })
    }
    return points
  }

  it('윤곽은 왼쪽 옆변 아래에서 시작해 어깨(모서리 파임 + 아치 높이)까지 올라간다', () => {
    expect(plaquePath(plaque).startsWith('M0 430V37A12 12 ')).toBe(true)
  })

  it('안쪽으로 들인 윤곽은 좌우 대칭이고, 현판 안에 d 만큼 들어와 있다', () => {
    for (const d of [0, 1, 6, 7]) {
      const points = endpoints(plaquePath(plaque, d))
      for (const { x, y } of points) {
        expect(x).toBeGreaterThanOrEqual(d - 0.01)
        expect(x).toBeLessThanOrEqual(plaque.width - d + 0.01)
        expect(y).toBeGreaterThanOrEqual(d - 0.01)
        expect(y).toBeLessThanOrEqual(plaque.height - d + 0.01)
        expect(
          points.some(
            (other) =>
              Math.abs(other.x - (plaque.width - x)) < 0.02 &&
              Math.abs(other.y - y) < 0.02,
          ),
        ).toBe(true)
      }
    }
  })

  it('들인 윤곽의 어깨 점은 바깥 모서리 파임 · 아치와 같은 중심의 원 위에 있다 — 간격이 어디서나 d 다', () => {
    const { width, notch, arch } = plaque
    const reach = width / 2 - notch
    const radius = (reach * reach + arch * arch) / (2 * arch)
    for (const d of [1, 6]) {
      // M · V 다음, 모서리 파임 원호가 끝나는 점이 왼쪽 어깨입니다
      const shoulder = endpoints(plaquePath(plaque, d))[2]
      expect(shoulder).toBeDefined()
      const { x = 0, y = 0 } = shoulder ?? {}
      expect(Math.hypot(x, y - arch)).toBeCloseTo(notch + d, 1)
      expect(Math.hypot(x - width / 2, y - radius)).toBeCloseTo(radius - d, 1)
    }
  })
})

describe('tagMetrics', () => {
  /** 1920 x 1080 부터 휴대폰까지의 진열장 자리 — [폭, 높이, 상세 패널을 얹는가] */
  const WALLS = [
    [1800, 800, true],
    [1800, 670, true],
    [1560, 670, true],
    [1340, 620, true],
    [1340, 500, true],
    [1266, 460, true],
    [944, 488, true],
    [708, 553, false],
    [372, 380, false],
    [350, 380, false],
    [280, 380, false],
  ] as const

  const tagOf = (width: number, height: number, panel: boolean) => {
    const { tagWidth, tagHeight } = shelfLayout(width, height, { panel })
    return { tagWidth, tagHeight, ...tagMetrics(tagWidth, tagHeight) }
  }

  it('태그 170 x 140 에서 파임 10 · 테두리선 5 · 아일릿 10 · 고리 10 이고 두 줄 이름을 적는다', () => {
    const { notch, inset, eyelet, eyeletTop, bead, detail } = tagMetrics(
      170,
      140,
    )
    expect({ notch, inset, eyelet, eyeletTop, bead, detail }).toEqual({
      notch: 10,
      inset: 5,
      eyelet: 10,
      eyeletTop: 10,
      bead: 10,
      detail: 'two-line',
    })
  })

  it('태그는 브랜드 한 줄 + 두 줄 이름이 드는 높이(최소 80)로 서서, 1920 x 1080 부터 320 휴대폰까지 두 줄 이름을 적는다', () => {
    for (const [width, height, panel] of WALLS) {
      const { tagHeight, detail } = tagOf(width, height, panel)
      expect(tagHeight).toBeGreaterThanOrEqual(80)
      expect(detail).toBe('two-line')
    }
    // 1920 x 1080 · 1440 x 900 의 태그
    expect(tagOf(1800, 800, true)).toMatchObject({
      tagWidth: 135,
      tagHeight: 85,
    })
    expect(tagOf(1340, 620, true)).toMatchObject({
      tagWidth: 95,
      tagHeight: 80,
    })
  })

  it('이름표 자리 한도에 걸려 태그가 70 아래로 줄어든 창에서만 이름을 한 줄로 줄인다', () => {
    expect(tagMetrics(110, 70).detail).toBe('two-line')
    expect(tagMetrics(100, 65).detail).toBe('one-line')
  })

  it('아일릿은 안쪽 테두리선 아래에 앉고, 고리 반구의 높이는 온 픽셀이다', () => {
    for (const [width, height, panel] of WALLS) {
      const { inset, eyeletTop, eyelet, notch, bead, tagWidth } = tagOf(
        width,
        height,
        panel,
      )
      expect(eyeletTop).toBeGreaterThan(inset + 1)
      // 아일릿이 파낸 모서리보다 안쪽 · 태그 윗부분에 섭니다
      expect(eyeletTop + eyelet).toBeLessThan(tagWidth / 2 - notch)
      expect(bead % 2).toBe(0)
    }
  })

  it('clip-path 값 — 종이는 윤곽 하나, 띠는 바깥 윤곽과 들인 윤곽을 evenodd 로 겹친다', () => {
    const tag = tagMetrics(170, 140)
    expect(tag.shape).toBe(`path("${ticketPath(170, 140, 10)}")`)
    expect(tag.edgeRing).toBe(
      `path(evenodd, "${ticketPath(170, 140, 10)} ${ticketPath(170, 140, 10, 1)}")`,
    )
    expect(tag.lineRing).toContain(ticketPath(170, 140, 10, 6))
    expect(tag.focusRing).toContain(ticketPath(170, 140, 10, 2))
  })
})

describe('ticketPath', () => {
  it('네 모서리를 반지름 notch 인 원호로 파낸다', () => {
    expect(ticketPath(170, 140, 10)).toBe(
      'M10 0H160A10 10 0 0 0 170 10V130A10 10 0 0 0 160 140H10A10 10 0 0 0 0 130V10A10 10 0 0 0 10 0Z',
    )
  })

  it('안쪽으로 들인 윤곽의 끝점은 태그 안 d 에 있고, 모서리 중심에서 notch + d 떨어져 있다 — 간격이 어디서나 d 다', () => {
    const [width, height, notch] = [170, 140, 10]
    for (const d of [1, 5, 6]) {
      const numbers = [
        ...ticketPath(width, height, notch, d).matchAll(/[MHVA]([^MHVAZ]*)/g),
      ]
      // 원호(A)가 끝나는 점만 모읍니다 — 파낸 모서리가 끝나는 자리입니다
      const arcEnds = numbers
        .filter(([command]) => command.startsWith('A'))
        .map(([, args = '']) => args.trim().split(/\s+/).map(Number).slice(5))
      expect(arcEnds).toHaveLength(4)
      const corners = [
        [width, 0],
        [width, height],
        [0, height],
        [0, 0],
      ] as const
      arcEnds.forEach(([x = 0, y = 0], at) => {
        const [cx, cy] = corners[at] ?? [0, 0]
        expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(notch + d, 1)
        expect(Math.min(x, width - x, y, height - y)).toBeCloseTo(d, 1)
      })
    }
  })
})
