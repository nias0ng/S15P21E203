import { describe, expect, it } from 'vitest'

import {
  formatShelfDate,
  layoutWall,
  nameWithoutBrand,
  revealStart,
  sectionAt,
  shelfMetrics,
  snapStart,
  swingStep,
  type Swing,
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
  const OPTIONS = { omega: 6.6, damping: 0.14, gain: 1 / 1800, limit: 0.25 }
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

  it('아무리 세게 밀어도 한도를 넘지 않는다', () => {
    expect(swingStep(STILL, 1e9, FRAME, OPTIONS).angle).toBe(OPTIONS.limit)
  })
})

describe('shelfMetrics', () => {
  it('1920 x 1080 의 진열장 자리(1800 x 780, 가리지 않는 폭 1440)에서 벽감 605 · 병 420 · 칸 225 가 된다', () => {
    const metrics = shelfMetrics(1800, 780, 1440)
    expect(metrics.caseHeight).toBe(605)
    expect(metrics.bottle).toBe(420)
    expect(metrics.visible).toBe(8)
    expect(metrics.pitch).toBe(225)
    expect(metrics.clear).toBe(6)
  })

  it('병 사진은 벽감 높이의 70% 로 서고, 칸을 좁혀도 벽감 높이는 그대로다', () => {
    // 1440 x 900 의 진열장 자리(1340 x 600, 가리지 않는 폭 1020). 벽감 440 은 예전과 같은 값입니다
    const { caseHeight, bottle } = shelfMetrics(1340, 600, 1020)
    expect(caseHeight).toBe(440)
    expect(bottle).toBe(305)
  })

  it('가리지 않는 칸은 패널에 가리지 않는 폭 안에 온전히 들어간다', () => {
    const { clear, pitch } = shelfMetrics(1800, 780, 1440)
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
      const { caseHeight } = shelfMetrics(1440, height)
      expect(caseHeight + 85).toBeLessThanOrEqual(height)
    }
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

/** 이름만 다른 향수 n 개 */
const bottles = (n: number, category: ShelfItem['category']): ShelfItem[] =>
  Array.from({ length: n }, (_, at) => ({
    shelfItemId: at,
    perfumeId: at,
    name: `향수 ${at}`,
    brand: '브랜드',
    thumbnailUrl: null,
    category,
    representative: false,
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

describe('layoutWall', () => {
  it('분류마다 이름표 벽 한 칸 뒤에 벽감을 붙이고, 끝 벽을 한 칸 더 둔다', () => {
    const { sections, total } = layoutWall(SECTIONS)
    expect(
      sections.map(({ plaque, start, span }) => [plaque, start, span]),
    ).toEqual([
      [0, 1, 5],
      [6, 7, 17],
      [24, 25, 3],
    ])
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

  it('병이 한 화면을 못 채우는 분류 뒤에는 빈 벽을 둬서 다음 분류가 그 화면에 비치지 않는다', () => {
    // 창 전체 여덟 칸. 보유 중은 이름표 1 + 병 5 = 6칸이라 빈 벽 2칸을 두어, 시향해 봄 이름표가
    // 여덟째 칸(창 밖)에서 시작합니다. 시향해 봄은 한 화면을 넘고, 보유 희망은 마지막이라 비우지 않습니다
    const { sections, total } = layoutWall(SECTIONS, 8)
    expect(sections.map(({ plaque, gap }) => [plaque, gap])).toEqual([
      [0, 2],
      [8, 0],
      [26, 0],
    ])
    expect(total).toBe(31)
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
  it('굴린 쪽으로 다음 병이 조금만 들어와도 그 병을 마저 들인다', () => {
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
