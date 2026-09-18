import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import type { PersonalRecommendation, RecommendResult } from './types'

/**
 * NLR-01 자연어 기반 추천.
 *
 * **조회인데 `POST` 입니다.** 사용자가 쓴 문장이 최대 500자라 쿼리스트링에 담기
 * 어렵고, 담으면 그 문장이 접근 로그에 그대로 남습니다 (백엔드 컨트롤러 주석).
 *
 * **비회원도 부를 수 있습니다** — 로그인 여부가 결과에 영향을 주지 않습니다.
 *
 * ⚠️ **향수를 못 찾아도 200 입니다.** 0개인 경우가 두 종류라 `status` 로 구분합니다
 * (`RecommendStatus`). 화면이 넷을 다르게 말해야 합니다.
 * ⚠️ 이 엔드포인트만 나는 오류가 둘 있습니다 — **429**(호출량 제한) · **503**(AI 서버가
 * 응답하지 않음). 둘 다 다른 기능은 멀쩡하므로 화면이 따로 말해 줍니다.
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
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다 — `features/perfume/api.ts` ·
 * `features/map/api.ts` 와 같은 규칙입니다. **요청이 백엔드에 닿지도 못했을 때만**
 * (status 0 · 502~504) 끼어들고, 429 · 503 처럼 서버가 대답한 오류는 그대로 올려보냅니다.
 * 운영에서는 끼어들지 않습니다.
 *
 * ⚠️ **503 이 두 뜻이라 조심합니다.** vite 프록시가 백엔드에 못 닿아도 503 이 될 수 있고,
 * 백엔드가 살아서 "AI 서버가 죽었다" 고 해도 503 입니다. 뒤엣것은 사용자에게 알려야 하므로
 * `env.isDev` 일 때만 대체값으로 덮습니다 — 운영에서는 늘 진짜 사정이 전해집니다.
 *
 * ⚠️ 세 번째 복사본입니다. `shared/api` 로 올릴 후보인데, 올리려면 perfume · map 도메인을
 * 함께 고쳐야 하고 그 두 파일은 지금 다른 갈래에서 손보는 중이라 여기 둡니다. 세 갈래가
 * 합쳐질 때 한 번에 올립니다.
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
 * ⚠️ 백엔드 · AI 추천 API 가 아직 없어 고정값을 돌려줍니다. API 가 준비되면
 * 이 함수 본문만 바꾸세요.
 *
 *   const { data } = await http.get<PersonalRecommendation>('/recommendations/personal')
 *   return data
 *
 * 추천할 것이 없으면 null 입니다. 담은 향수가 적거나 취향이 한쪽으로 쏠려 있지
 * 않으면 추천 엔진도 내놓을 것이 없습니다 — 그때 억지로 하나 고르면 카드의
 * "왜 당신에게" 가 거짓이 됩니다. 화면은 null 이면 카드를 아예 그리지 않습니다.
 *
 * ⚠️ **이미 진열대에 있는 향수는 추천에서 빠져야 합니다.** 거르는 일은 화면이 아니라
 * 추천 엔진의 몫입니다 — 엔진이 이미 진열대를 보고 있고(그게 추천의 근거입니다),
 * 화면에서 걸러 내면 "추천을 받았는데 다 걸러져 0개" 인 상태를 화면이 떠안게 됩니다.
 * 어느 칸까지 뺄지(보유 중 · 보유 희망 · 시향해 봄)는 연동 때 백엔드와 맞춥니다.
 * 아래 자리표시자도 그래서 진열대 자리표시자에 없는 향수로 골랐습니다.
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
