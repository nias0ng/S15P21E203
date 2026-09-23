import { describe, expect, it } from 'vitest'

import type { VoyageLogEntry } from '../types'

import { groupVoyageLogByDay } from './voyageLogDays'

/*
 * 시각은 **이 컴퓨터의 시간대로** 만듭니다(`new Date(년, 월, 일, 시, 분)`). 묶기가 보는 사람의
 * 시간대로 날을 가르므로, 시험이 어느 시간대에서 돌아도 같은 답이 나와야 합니다.
 */
const at = (month: number, date: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, date, hour, minute).toISOString()

const NOW = new Date(2026, 8, 23, 12, 0)

let nextId = 1
const entry = (
  enteredAt: string,
  region: VoyageLogEntry['region'],
  visited: VoyageLogEntry['visited'] = [],
): VoyageLogEntry => ({
  entryId: nextId++,
  enteredAt,
  scentRegionId: 0,
  region,
  visited,
})

const perfume = (perfumeId: number) => ({
  perfumeId,
  name: `향수 ${perfumeId}`,
})

describe('groupVoyageLogByDay', () => {
  it('같은 날의 진입은 한 덩어리로 묶고 오늘은 "오늘", 지난날은 MM.DD 로 적는다', () => {
    const days = groupVoyageLogByDay(
      [
        entry(at(9, 23, 10, 44), 'CITRUS'),
        entry(at(9, 23, 10, 41), 'GREEN'),
        entry(at(9, 22, 17, 56), 'WOODY'),
        entry(at(9, 18, 10, 6), 'FLORAL'),
      ],
      NOW,
    )

    expect(days.map((day) => day.label)).toEqual(['오늘', '09.22', '09.18'])
    expect(days.map((day) => day.regions)).toEqual([
      ['CITRUS', 'GREEN'],
      ['WOODY'],
      ['FLORAL'],
    ])
  })

  it('해역과 향수를 따로 모은다 — 향수는 어느 해역에서 봤든 그날 목록 하나에 담긴다', () => {
    const [today] = groupVoyageLogByDay(
      [
        entry(at(9, 23, 11), 'WOODY', [perfume(3)]),
        entry(at(9, 23, 10), 'CITRUS', [perfume(1), perfume(2)]),
      ],
      NOW,
    )

    expect(today?.regions).toEqual(['WOODY', 'CITRUS'])
    // 한 줄 안에서는 처음 들른 순서로 오므로(1 → 2) 뒤집어 날 전체를 최근 순으로 맞춘다
    expect(today?.perfumes.map((p) => p.perfumeId)).toEqual([3, 2, 1])
  })

  it('같은 날 다시 들어간 해역 · 다시 본 향수는 가장 최근 것 하나만 남긴다', () => {
    const [today] = groupVoyageLogByDay(
      [
        entry(at(9, 23, 11), 'FLORAL', [perfume(7)]),
        entry(at(9, 23, 10), 'MUSK'),
        entry(at(9, 23, 9), 'FLORAL', [perfume(7), perfume(8)]),
      ],
      NOW,
    )

    expect(today?.regions).toEqual(['FLORAL', 'MUSK'])
    expect(today?.perfumes.map((p) => p.perfumeId)).toEqual([7, 8])
  })

  it('다른 날에 본 같은 향수는 그날그날 따로 남긴다', () => {
    const days = groupVoyageLogByDay(
      [
        entry(at(9, 23, 10), 'WOODY', [perfume(5)]),
        entry(at(9, 21, 10), 'WOODY', [perfume(5)]),
      ],
      NOW,
    )

    expect(days.map((day) => day.perfumes.map((p) => p.perfumeId))).toEqual([
      [5],
      [5],
    ])
  })

  it('자정을 넘긴 진입은 그다음 날로 간다 — 서버가 주는 UTC 날짜가 아니라 보는 사람의 날짜다', () => {
    const days = groupVoyageLogByDay(
      [entry(at(9, 23, 0, 10), 'AQUATIC'), entry(at(9, 22, 23, 50), 'AMBER')],
      NOW,
    )

    expect(days.map((day) => [day.label, day.regions])).toEqual([
      ['오늘', ['AQUATIC']],
      ['09.22', ['AMBER']],
    ])
  })

  it('오늘 들어간 곳이 없으면 "오늘" 머리말도 없다', () => {
    const days = groupVoyageLogByDay([entry(at(9, 22, 9), 'GOURMAND')], NOW)

    expect(days.map((day) => day.label)).toEqual(['09.22'])
  })

  it('못 읽는 시각이어도 줄을 버리지 않는다 — 문자열의 날짜 칸으로 묶는다', () => {
    const days = groupVoyageLogByDay(
      [entry('2026-09-20 어딘가', 'FRUITY')],
      NOW,
    )

    expect(days).toEqual([
      {
        key: '2026-09-20',
        label: '09.20',
        regions: ['FRUITY'],
        perfumes: [],
      },
    ])
  })

  it('빈 일지는 빈 목록이다', () => {
    expect(groupVoyageLogByDay([], NOW)).toEqual([])
  })
})
