import { describe, expect, it } from 'vitest'

import { readPersonalReason } from './personalReason'

/*
 * 틀 셋은 서버 `PersonalizedRecommendationService.reasonOf` 의 문장 그대로입니다. 서버 통합 테스트가
 * `"높게 평가한 향수와 woody 어코드가 비슷해요."` 를 그대로 기대하고 있어, 같은 말로 적습니다.
 */
describe('readPersonalReason', () => {
  it('적합도 틀 — 영어 향 특성을 한국어로 바꿔 다시 짓는다', () => {
    expect(
      readPersonalReason('높게 평가한 향수와 woody 어코드가 비슷해요.'),
    ).toEqual({
      source: 'FIT',
      keyword: '우디',
      sentence: '높게 평가한 향수와 우디 어코드가 비슷해요.',
    })
  })

  it('최근 본 향수 틀 — 두 낱말 향 특성도 한 덩이로 읽는다', () => {
    expect(
      readPersonalReason(
        '최근 살펴본 향수에서 자주 만난 white floral 어코드를 담고 있어요.',
      ),
    ).toEqual({
      source: 'RECENT',
      keyword: '화이트 플로럴',
      sentence:
        '최근 살펴본 향수에서 자주 만난 화이트 플로럴 어코드를 담고 있어요.',
    })
  })

  it('취향 테스트 틀 — 향 계열은 이미 한국어라 그대로 둔다', () => {
    expect(
      readPersonalReason('취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.'),
    ).toEqual({
      source: 'TASTE',
      keyword: '시트러스',
      sentence: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
    })
  })

  it('표에 없는 향 특성은 영어 그대로 흘려보낸다', () => {
    expect(
      readPersonalReason('높게 평가한 향수와 moonlight 어코드가 비슷해요.')
        .keyword,
    ).toBe('moonlight')
  })

  it('모르는 틀이면 갈래 없이 문장만 그대로 — 틀이 바뀌어도 화면이 깨지지 않는다', () => {
    expect(readPersonalReason('  새로 생긴 근거 문장이에요.  ')).toEqual({
      source: null,
      keyword: null,
      sentence: '새로 생긴 근거 문장이에요.',
    })
  })
})
