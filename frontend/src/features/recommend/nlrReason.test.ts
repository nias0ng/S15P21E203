import { describe, expect, it } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import {
  conditionLabel,
  nlrReasonSentence,
  type ReasonContext,
} from './nlrReason'
import type { RecommendReason } from './types'

/**
 * 표현이 다 들어 있는 문장을 기본으로 씁니다 — 문장에 없는 표현을 거르는 검사는 아래에서
 * 따로 합니다.
 */
const build = (
  reasons: RecommendReason[],
  context: Partial<ReasonContext> = {},
) =>
  nlrReasonSentence(reasons, {
    query: reasons.map((reason) => reason.phrase ?? '').join(' '),
    pickedWithoutScentCondition: false,
    ...context,
  })

/** 토막을 이어 붙인 문장 — 화면이 토막마다 칠만 달리하므로 사용자가 읽는 글과 같습니다 */
const sentenceOf = (
  reasons: RecommendReason[],
  context?: Partial<ReasonContext>,
) =>
  build(reasons, context)
    ?.parts.map((part) => part.text)
    .join('')

/*
 * 표현 · 향 특성 · 강도는 AI 엔진에 문장을 넣어 실제로 받은 값입니다
 * (`빨래 냄새 나는 향수 찾고 있어` → soapy 100 · fresh 93).
 */
describe('nlrReasonSentence', () => {
  it('표현이 가리키는 향과 강도를 한 문장으로 짓는다', () => {
    expect(
      sentenceOf([
        { phrase: '빨래', evidence: 'soapy · fresh', strengths: [100, 93] },
      ]),
    ).toBe(
      '이 향수는 ‘빨래’가 가리키는 비누(100) · 프레시(93) 향을 가지고 있습니다.',
    )
  })

  // 조사를 하나로 고정하면 ‘달달’가 · ‘상큼한’가 처럼 틀린 말이 나갑니다
  it('조사는 표현의 끝 글자 받침을 보고 고른다', () => {
    expect(
      sentenceOf([
        { phrase: '달달', evidence: 'caramel · sweet', strengths: [100, 100] },
      ]),
    ).toBe(
      '이 향수는 ‘달달’이 가리키는 카라멜(100) · 스위트(100) 향을 가지고 있습니다.',
    )
    expect(
      sentenceOf([{ phrase: '상큼한', evidence: 'citrus', strengths: [100] }]),
    ).toBe('이 향수는 ‘상큼한’이 가리키는 시트러스(100) 향을 가지고 있습니다.')
  })

  it('한글로 끝나지 않는 표현은 받침이 없는 것으로 본다', () => {
    expect(
      sentenceOf([{ phrase: 'CK', evidence: 'citrus', strengths: [90] }]),
    ).toBe('이 향수는 ‘CK’가 가리키는 시트러스(90) 향을 가지고 있습니다.')
  })

  // 노트 이름을 말하면 AI 가 어느 글자에서 왔는지를 안 채워 표현이 빕니다 (노트 별칭 196개 중 183개)
  it('표현이 없으면 요청하신 향으로 적는다', () => {
    expect(
      sentenceOf([
        {
          phrase: null,
          evidence: 'floral · powdery · yellow floral',
          strengths: [100, 96, 93],
        },
      ]),
    ).toBe(
      '이 향수는 요청하신 플로럴(100) · 파우더리(96) · 옐로 플로럴(93) 향을 가지고 있습니다.',
    )
  })

  it('표현이 여럿이면 표현마다 제 향을 붙여 잇는다 — 어느 말이 어느 향인지 남긴다', () => {
    expect(
      sentenceOf([
        {
          phrase: '베이비파우더',
          evidence: 'powdery · musky',
          strengths: [100, 79],
        },
        { phrase: '나무', evidence: 'woody', strengths: [81] },
        {
          phrase: '촉촉하고',
          evidence: 'green · aquatic',
          strengths: [76, 45],
        },
      ]),
    ).toBe(
      '이 향수는 ‘베이비파우더’가 가리키는 파우더리(100) · 머스키(79), ‘나무’가 가리키는 우디(81), ‘촉촉하고’가 가리키는 그린(76) · 아쿠아틱(45) 향을 가지고 있습니다.',
    )
  })

  it('표현이 있는 묶음과 없는 묶음이 섞여도 한 문장이다', () => {
    expect(
      sentenceOf([
        { phrase: '빨래', evidence: 'soapy', strengths: [100] },
        { phrase: null, evidence: 'woody', strengths: [64] },
      ]),
    ).toBe(
      '이 향수는 ‘빨래’가 가리키는 비누(100), 요청하신 우디(64) 향을 가지고 있습니다.',
    )
  })

  // 백엔드가 AccordLabeler 를 채워 한국어를 보내기 시작해도 문장이 그대로 서야 합니다
  it('이미 한국어인 향 이름은 그대로 쓴다', () => {
    expect(
      sentenceOf([
        {
          phrase: '빨래',
          evidence: '비누 같은 · 산뜻한',
          strengths: [100, 93],
        },
      ]),
    ).toBe(
      '이 향수는 ‘빨래’가 가리키는 비누 같은(100) · 산뜻한(93) 향을 가지고 있습니다.',
    )
  })

  describe('사용자가 쓴 말만 표현으로 옮긴다', () => {
    /*
      LLM 단계가 '우드향' 을 풀어 쓴 말이 표현 칸에 옵니다 (실측). 따옴표로 옮기면 사용자가
      하지 않은 말을 한 것이 됩니다.
    */
    it('문장에 없는 표현은 요청하신 향으로 적는다', () => {
      expect(
        sentenceOf([{ phrase: 'woody', evidence: 'woody', strengths: [100] }], {
          query: '가을에 쓸 남성적인 우드향 추천해줘.',
        }),
      ).toBe('이 향수는 요청하신 우디(100) 향을 가지고 있습니다.')
    })

    it('띄어쓰기 · 대소문자가 달라도 쓴 말로 본다', () => {
      expect(
        sentenceOf(
          [{ phrase: '베이비파우더', evidence: 'powdery', strengths: [100] }],
          { query: '베이비 파우더처럼 포근한 향' },
        ),
      ).toBe(
        '이 향수는 ‘베이비파우더’가 가리키는 파우더리(100) 향을 가지고 있습니다.',
      )
      expect(
        sentenceOf([{ phrase: 'CK', evidence: 'citrus', strengths: [90] }], {
          query: 'ck 같은 향수',
        }),
      ).toBe('이 향수는 ‘CK’가 가리키는 시트러스(90) 향을 가지고 있습니다.')
    })
  })

  /*
    향 조건이 하나도 없으면 백엔드가 성별 · 계절 · 낮밤 · 노트로 이유를 채우고 강도를 전부 null 로
    둡니다. 그 이름들을 "… 향을 가지고 있습니다" 로 적으면 향으로 고른 것처럼 읽힙니다.
  */
  it('강도가 전부 null 이면 향이 아닌 조건에 맞는다고 적는다', () => {
    const sentence = build([
      {
        phrase: null,
        evidence: '남성적인 · 가을에 어울리는',
        strengths: [null, null],
      },
      { phrase: '미모사', evidence: '미모사', strengths: [null] },
    ])

    expect(sentence?.parts.map((part) => part.text).join('')).toBe(
      '요청하신 남성적인 · 가을에 어울리는 · 미모사 조건에 맞는 향수입니다.',
    )
    expect(sentence?.showsStrength).toBe(false)
  })

  // 두 배포 사이 — 이 칸을 아직 모르는 서버와 만나도 화면이 깨지지 않아야 합니다
  describe('강도가 오지 않으면', () => {
    it('숫자 없이 문장만 짓고, 머리글에 숫자의 뜻을 적지 않게 한다', () => {
      const sentence = build([{ phrase: '빨래', evidence: 'soapy · fresh' }])

      expect(sentence?.parts.map((part) => part.text).join('')).toBe(
        '이 향수는 ‘빨래’가 가리키는 비누 · 프레시 향을 가지고 있습니다.',
      )
      expect(sentence?.showsStrength).toBe(false)
    })

    it('향 없이 고른 응답이면 조건 문장으로 짓는다', () => {
      expect(
        sentenceOf([{ phrase: null, evidence: '남성적인 · 가을에 어울리는' }], {
          pickedWithoutScentCondition: true,
        }),
      ).toBe('요청하신 남성적인 · 가을에 어울리는 조건에 맞는 향수입니다.')
    })
  })

  describe('틀린 숫자보다 없는 쪽이 낫다', () => {
    // 순서로만 짝지어져 있어 하나가 빠지면 뒤의 숫자가 전부 한 칸씩 밀린 향에 붙습니다
    it('강도 개수가 조각 수와 다르면 숫자를 모두 뺀다', () => {
      expect(
        sentenceOf([
          { phrase: '빨래', evidence: 'soapy · fresh', strengths: [93] },
        ]),
      ).toBe('이 향수는 ‘빨래’가 가리키는 비누 · 프레시 향을 가지고 있습니다.')
    })

    it('0~100 을 벗어나거나 빈 강도는 그 자리만 이름으로 둔다', () => {
      expect(
        sentenceOf([
          {
            phrase: '빨래',
            evidence: 'soapy · fresh · musky',
            strengths: [150, 93, null],
          },
        ]),
      ).toBe(
        '이 향수는 ‘빨래’가 가리키는 비누 · 프레시(93) · 머스키 향을 가지고 있습니다.',
      )
    })
  })

  it('지을 이유가 없으면 null 이다', () => {
    expect(build([])).toBeNull()
    expect(build([{ phrase: '빨래', evidence: '', strengths: [] }])).toBeNull()
  })
})

describe('nlrReasonSentence — 영어 화면', () => {
  // 문장 가운데의 향 이름은 소문자로, 강도는 한 칸 띄워 적습니다
  it('영어 틀로 짓고 향 이름 · 조건 이름을 영어로 쓴다', () => {
    useLocaleStore.getState().setLocale('en')

    expect(
      sentenceOf([
        { phrase: '빨래', evidence: 'soapy · fresh', strengths: [100, 93] },
        { phrase: null, evidence: 'woody', strengths: [81] },
      ]),
    ).toBe(
      "This perfume has the soapy (100) · fresh (93) scent that '빨래' suggests, and the woody (81) scent you asked for.",
    )
    expect(
      sentenceOf([
        {
          phrase: null,
          evidence: '남성적인 · 가을에 어울리는',
          strengths: [null, null],
        },
      ]),
    ).toBe('Fits what you asked for: Masculine · Fall.')
  })

  it('묶음이 셋 이상이면 마지막 묶음 앞에만 and 를 붙인다', () => {
    useLocaleStore.getState().setLocale('en')

    expect(
      sentenceOf([
        { phrase: '베이비파우더', evidence: 'powdery', strengths: [100] },
        { phrase: '나무', evidence: 'woody', strengths: [81] },
        { phrase: null, evidence: 'fresh spicy', strengths: [45] },
      ]),
    ).toBe(
      "This perfume has the powdery (100) scent that '베이비파우더' suggests, the woody (81) scent that '나무' suggests, and the fresh spicy (45) scent you asked for.",
    )
  })

  // 노트 이름은 사용자가 쓴 한국어 그대로라 영어 문장 속에서 인용한 말로 감쌉니다
  it('표에 없는 조건(사용자가 쓴 노트 이름)은 따옴표로 감싼다', () => {
    useLocaleStore.getState().setLocale('en')

    expect(
      sentenceOf([
        {
          phrase: null,
          evidence: '남성적인 · 밤에 어울리는',
          strengths: [null, null],
        },
        { phrase: '미모사', evidence: '미모사', strengths: [null] },
      ]),
    ).toBe("Fits what you asked for: Masculine · Night · '미모사'.")
  })
})

describe('conditionLabel', () => {
  it('정해진 조건은 화면 언어로 바꾸고, 노트 이름은 한국어 화면에서 그대로 둔다', () => {
    expect(conditionLabel('낮에 어울리는')).toBe('낮에 어울리는')
    expect(conditionLabel('장미')).toBe('장미')
  })

  it('영어 화면은 조건을 영어로, 노트 이름은 따옴표로 감싼다', () => {
    useLocaleStore.getState().setLocale('en')

    expect(conditionLabel('낮에 어울리는')).toBe('Day')
    expect(conditionLabel('장미')).toBe("'장미'")
  })
})
