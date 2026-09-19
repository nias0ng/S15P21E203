import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import type { PersonalRecommendation, RecommendResult } from './types'

/**
 * NLR-01 자연어 기반 추천. **조회인데 `POST`** 입니다 — 문장이 최대 500자이고,
 * 쿼리스트링에 담으면 접근 로그에 그대로 남습니다. 비회원도 부를 수 있습니다.
 *
 * ⚠️ **향수를 못 찾아도 200 입니다** — 0개인 경우가 두 종류라 `status` 로 넷을
 * 구분합니다. ⚠️ 이 엔드포인트만 나는 오류가 둘 — **429**(호출량) · **503**(AI 서버).
 */
export async function getRecommendation(
  query: string,
): Promise<RecommendResult> {
  return withDevFallback(
    async () => {
      const { data } = await http.post<RecommendResult>(
        '/recommendations/natural-language',
        { query },
      )
      return data
    },
    () => placeholderRecommendation(query),
  )
}

/**
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때(status 0 · 502~504)만 대체값으로 넘어갑니다.
 *
 * ⚠️ **503 이 두 뜻입니다** — 프록시가 백엔드에 못 닿아도, 백엔드가 살아서 "AI 서버가
 * 죽었다" 고 해도 503 입니다. 뒤엣것은 알려야 하므로 `env.isDev` 일 때만 덮습니다.
 *
 * ⚠️ 세 번째 복사본입니다. perfume · map 갈래가 합쳐질 때 `shared/api` 로 올립니다.
 */
async function withDevFallback<T>(
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unreachable =
      isApiError(error) &&
      (error.status === 0 || (error.status >= 502 && error.status <= 504))

    if (!env.isDev || !unreachable) throw error

    console.warn(
      '[recommend] 백엔드에 닿지 못해 개발용 대체 추천을 씁니다. 실제 값이 아닙니다.',
    )
    return fallback()
  }
}

/** 와이어프레임의 예시 결과. 백엔드 없이 화면을 볼 때만 씁니다 */
function placeholderRecommendation(query: string): RecommendResult {
  return {
    status: 'OK',
    query,
    perfumes: [
      {
        perfumeId: 1,
        name: '조 말론 우드 세이지',
        brand: '조 말론 런던',
        thumbnailUrl: null,
        reasons: [
          { phrase: '차분한', evidence: '시더 · 베티버' },
          { phrase: '촉촉한', evidence: '씨 솔트' },
          { phrase: null, evidence: '가을 어울림 평가 71%' },
        ],
      },
      {
        perfumeId: 2,
        name: '딥디크 오르페옹',
        brand: '딥디크',
        thumbnailUrl: null,
        reasons: [
          { phrase: '차분한', evidence: '아이리스' },
          { phrase: '숲속', evidence: '주니퍼' },
        ],
      },
      {
        perfumeId: 3,
        name: '르 라보 상탈 33',
        brand: '르 라보',
        thumbnailUrl: null,
        reasons: [
          { phrase: '묵직한', evidence: '샌달우드' },
          { phrase: '비 온 뒤', evidence: '파피루스' },
        ],
      },
    ],
  }
}

/**
 * REC-12 · REC-13 개인화 맞춤 추천 — 진열대 화면의 추천 카드.
 *
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없어 고정값을 돌려줍니다. 준비되면 본문만 바꾸세요.
 *
 *   const { data } = await http.get<PersonalRecommendation>('/recommendations/personal')
 *
 * 추천할 것이 없으면 null 이고, 화면은 그때 카드를 아예 그리지 않습니다.
 *
 * ⚠️ **이미 진열대에 있는 향수를 거르는 일은 추천 엔진의 몫입니다** — 화면에서 걸러
 * 내면 "추천을 받았는데 다 걸러져 0개" 를 화면이 떠안습니다. 어느 칸까지 뺄지는
 * 연동 때 백엔드와 맞춥니다.
 */
export async function getPersonalRecommendation(): Promise<PersonalRecommendation | null> {
  return {
    perfumeId: 3,
    name: '딥티크 탐 다오',
    brand: '딥티크',
    thumbnailUrl: null,
    headline: '나무 냄새를 좋아하시는군요',
    reasons: [
      { phrase: null, evidence: '담아 두신 향수 7개 중 4개가 우디 계열입니다' },
      {
        phrase: null,
        evidence: '별점 5를 주신 두 향수가 모두 샌달우드를 씁니다',
      },
      { phrase: null, evidence: '가을에 맡은 향을 특히 오래 담아 두셨습니다' },
    ],
  }
}
