import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

import { readGenderFilter, readRankingFilter, SEASONS } from './types'

/* 필터 값은 주소에서 오므로 바깥에서 들어옵니다 — 모르는 값을 그대로 API 에 실으면 400 이라 목록이 통째로 빕니다 */
describe('readRankingFilter', () => {
  it.each(['OWNED', 'WISH', 'VIEWED'] as const)(
    '표에 있는 %s 는 통과한다',
    (value) => {
      expect(readRankingFilter(value)).toBe(value)
    },
  )

  it.each([
    ['없는 값', 'POPULAR'],
    ['소문자', 'owned'],
    ['성별 값', 'FEMALE'],
    ['빈 문자열', ''],
  ])('%s(%s)은 안 걸린 것으로 본다', (_label, value) => {
    expect(readRankingFilter(value)).toBeNull()
  })

  it('쿼리가 아예 없으면 안 걸린 것이다', () => {
    expect(readRankingFilter(null)).toBeNull()
  })
})

describe('readGenderFilter', () => {
  it.each(['FEMALE', 'MALE', 'UNISEX'] as const)(
    '표에 있는 %s 는 통과한다',
    (value) => {
      expect(readGenderFilter(value)).toBe(value)
    },
  )

  it('순위 필터 값은 성별로 통과하지 않는다', () => {
    expect(readGenderFilter('OWNED')).toBeNull()
  })

  it('쿼리가 아예 없으면 안 걸린 것이다', () => {
    expect(readGenderFilter(null)).toBeNull()
  })
})

describe('SEASONS', () => {
  it('이름표를 읽는 때의 화면 언어로 푼다', async () => {
    expect(SEASONS.map((season) => season.label)).toEqual([
      '봄',
      '여름',
      '가을',
      '겨울',
    ])

    useLocaleStore.getState().setLocale('en')
    await i18n.changeLanguage('en')

    expect(SEASONS.map((season) => season.label)).toEqual([
      'Spring',
      'Summer',
      'Fall',
      'Winter',
    ])
  })
})
