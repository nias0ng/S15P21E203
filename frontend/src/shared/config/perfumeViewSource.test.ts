import { describe, expect, it } from 'vitest'

import { perfumeViewState, readPerfumeViewState } from './perfumeViewSource'

describe('perfumeViewState', () => {
  it('들어온 길만 담는다', () => {
    expect(perfumeViewState('COMMUNITY')).toEqual({
      perfumeViewSource: 'COMMUNITY',
    })
  })

  it('건너온 향수가 있으면 함께 담는다', () => {
    expect(perfumeViewState('RELATED_PERFUME', 42)).toEqual({
      perfumeViewSource: 'RELATED_PERFUME',
      fromPerfumeId: 42,
    })
  })
})

describe('readPerfumeViewState', () => {
  it('실어 보낸 값을 그대로 읽는다', () => {
    expect(readPerfumeViewState(perfumeViewState('SCENT_MAP'))).toEqual({
      source: 'SCENT_MAP',
      fromPerfumeId: undefined,
    })
  })

  it.each([
    ['빈 state', null],
    ['undefined', undefined],
    ['모르는 값', { perfumeViewSource: 'NEWSLETTER' }],
    ['타입이 다른 값', { perfumeViewSource: 7 }],
    ['다른 화면이 쓰던 state', { from: '/perfumes' }],
  ])('%s 이면 DIRECT 다', (_label, state) => {
    expect(readPerfumeViewState(state).source).toBe('DIRECT')
  })

  it('RELATED_PERFUME 일 때만 건너온 향수를 읽는다', () => {
    expect(
      readPerfumeViewState({
        perfumeViewSource: 'RELATED_PERFUME',
        fromPerfumeId: 42,
      }).fromPerfumeId,
    ).toBe(42)

    expect(
      readPerfumeViewState({
        perfumeViewSource: 'SEARCH',
        fromPerfumeId: 42,
      }).fromPerfumeId,
    ).toBeUndefined()
  })

  it('숫자가 아닌 향수 번호는 버린다', () => {
    expect(
      readPerfumeViewState({
        perfumeViewSource: 'RELATED_PERFUME',
        fromPerfumeId: Number.NaN,
      }).fromPerfumeId,
    ).toBeUndefined()
  })
})
