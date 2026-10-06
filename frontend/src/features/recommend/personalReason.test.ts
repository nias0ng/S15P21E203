import { describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import { readPersonalReason } from './personalReason'

/*
 * 한국어 문장은 서버 `PersonalizedRecommendationReasons` 의 한국어 틀과 같은 말입니다 — 예전에 화면이
 * 서버 문장을 읽어 향 특성만 한국어로 바꿔 적던 것과 같은 글이 나와야 합니다.
 */
describe('readPersonalReason', () => {
  it('적합도 — 영어 향 특성을 한국어로 옮겨 문장을 짓는다', () => {
    expect(
      readPersonalReason({
        reason: '높게 평가한 향수와 woody 어코드가 비슷해요.',
        evidenceSource: 'FIT',
        evidenceKey: 'woody',
      }),
    ).toEqual({
      source: 'FIT',
      keyword: '우디',
      sentence: '높게 평가한 향수와 우디 어코드가 비슷해요.',
    })
  })

  it('최근 본 향수 — 두 낱말 향 특성도 한 덩이로 옮긴다', () => {
    expect(
      readPersonalReason({
        reason:
          '최근 살펴본 향수에서 자주 만난 white floral 어코드를 담고 있어요.',
        evidenceSource: 'RECENT',
        evidenceKey: 'white floral',
      }),
    ).toEqual({
      source: 'RECENT',
      keyword: '화이트 플로럴',
      sentence:
        '최근 살펴본 향수에서 자주 만난 화이트 플로럴 어코드를 담고 있어요.',
    })
  })

  it('취향 테스트 — 향 계열 코드를 계열 이름으로 옮긴다', () => {
    expect(
      readPersonalReason({
        reason: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
        evidenceSource: 'TASTE_TEST',
        evidenceKey: 'CITRUS',
      }),
    ).toEqual({
      source: 'TASTE_TEST',
      keyword: '시트러스',
      sentence: '취향 테스트에서 선택한 시트러스 계열과 잘 맞아요.',
    })
  })

  it('표에 없는 향 특성은 영어 그대로 넣는다', () => {
    expect(
      readPersonalReason({
        reason: '높게 평가한 향수와 moonlight 어코드가 비슷해요.',
        evidenceSource: 'FIT',
        evidenceKey: 'moonlight',
      }).sentence,
    ).toBe('높게 평가한 향수와 moonlight 어코드가 비슷해요.')
  })

  it('근거 칸이 없으면 서버 문장을 그대로 쓴다 — 이 칸을 모르는 서버', () => {
    expect(
      readPersonalReason({ reason: '  새로 생긴 근거 문장이에요.  ' }),
    ).toEqual({
      source: null,
      keyword: null,
      sentence: '새로 생긴 근거 문장이에요.',
    })
  })

  it('모르는 갈래면 서버 문장을 그대로 쓴다', () => {
    expect(
      readPersonalReason({
        reason: '새 신호의 문장이에요.',
        // 서버가 새 갈래를 더했을 때 — 타입 밖의 값이 옵니다
        evidenceSource: 'SEASON' as never,
        evidenceKey: 'autumn',
      }),
    ).toEqual({
      source: null,
      keyword: null,
      sentence: '새 신호의 문장이에요.',
    })
  })

  it('갈래만 알고 근거 값이 비었거나 모르는 계열 코드면 문장은 서버 그대로, 갈래는 남긴다', () => {
    expect(
      readPersonalReason({
        reason: '높게 평가한 향수와 woody 어코드가 비슷해요.',
        evidenceSource: 'FIT',
        evidenceKey: null,
      }),
    ).toEqual({
      source: 'FIT',
      keyword: null,
      sentence: '높게 평가한 향수와 woody 어코드가 비슷해요.',
    })
    expect(
      readPersonalReason({
        reason: '취향 테스트에서 선택한 달빛 계열과 잘 맞아요.',
        evidenceSource: 'TASTE_TEST',
        evidenceKey: 'MOONLIGHT',
      }),
    ).toEqual({
      source: 'TASTE_TEST',
      keyword: null,
      sentence: '취향 테스트에서 선택한 달빛 계열과 잘 맞아요.',
    })
  })

  describe('영어 화면', () => {
    it('근거 값으로 영어 문장을 짓는다 — 서버 문장이 한국어로 받아 둔 것이어도', () => {
      useLocaleStore.getState().setLocale('en')

      expect(
        readPersonalReason({
          reason: '높게 평가한 향수와 woody 어코드가 비슷해요.',
          evidenceSource: 'FIT',
          evidenceKey: 'woody',
        }),
      ).toEqual({
        // 근거 말은 칩과 같은 꼴, 문장 안에서는 소문자입니다
        source: 'FIT',
        keyword: 'Woody',
        sentence: 'It shares a woody accord with perfumes you rated highly.',
      })
      expect(
        readPersonalReason({
          reason: 'x',
          evidenceSource: 'RECENT',
          evidenceKey: 'fresh spicy',
        }).sentence,
      ).toBe(
        "It has the fresh spicy accord that often appears in perfumes you've viewed recently.",
      )
    })

    it('취향 테스트의 계열 코드는 영어 계열 이름이 된다 — MUSK 는 Musk', () => {
      useLocaleStore.getState().setLocale('en')

      expect(
        readPersonalReason({
          reason: '취향 테스트에서 선택한 머스크 계열과 잘 맞아요.',
          evidenceSource: 'TASTE_TEST',
          evidenceKey: 'MUSK',
        }),
      ).toEqual({
        source: 'TASTE_TEST',
        keyword: 'Musk',
        sentence:
          'It suits the Musk scent family you picked in the Taste Test.',
      })
    })

    it('근거 값이 없으면 서버가 영어로 준 문장을 그대로 쓴다', () => {
      useLocaleStore.getState().setLocale('en')

      expect(
        readPersonalReason({
          reason: 'Its woody accord is close to the perfumes you rated highly.',
          evidenceSource: 'FIT',
          evidenceKey: null,
        }).sentence,
      ).toBe('Its woody accord is close to the perfumes you rated highly.')
    })
  })
})
