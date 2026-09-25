import { http, isApiError } from '@/shared/api/http'
import { withDevFallback } from '@/shared/api/withDevFallback'

import type {
  PersonalRecommendationResult,
  RecommendResult,
  Satisfaction,
} from './types'

/**
 * NLR-01 자연어 기반 추천. 조회인데 `POST` 입니다 — 문장 500자를 쿼리스트링에 담으면
 * 접근 로그에 그대로 남습니다. 비회원도 부르고, 향수를 못 찾아도 200 입니다.
 * NOTE: 429(호출량) · 503(AI 서버) 은 이 엔드포인트만 납니다. 503 은 개발 프록시 실패와
 * 구분되지 않아 `withDevFallback` 이 개발 환경에서만 자리표시자로 덮습니다.
 */
export async function getRecommendation(
  query: string,
): Promise<RecommendResult> {
  return withDevFallback(
    'recommend',
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

/** 와이어프레임의 예시 결과. 백엔드 없이 화면을 볼 때만 씁니다 */
function placeholderRecommendation(query: string): RecommendResult {
  return {
    // 손잡이가 없으니 설문도 안 뜹니다 — 보낼 곳이 없는데 묻는 것은 거짓 화면입니다
    recommendationToken: null,
    status: 'OK',
    query,
    pickedWithoutScentCondition: false,
    matchedData: [],
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
 * NLR-08 추천 만족도. 결과 모달을 닫을 때 한 번 묻고 보냅니다.
 *
 * NOTE: **`withDevFallback` 을 쓰지 않습니다.** 그것은 읽기용입니다 — 쓰기를 대체값으로
 * 덮으면 아무 데도 안 남은 답을 보낸 것처럼 보이고, 화면은 고맙다고 인사합니다.
 *
 * NOTE: 한 추천에 한 번입니다. 두 번째는 **409** 이고, 그것은 오류가 아니라 이미 남겼다는
 * 뜻이라 화면이 실패로 다루면 안 됩니다. **429**(호출량)도 이 경로에 걸립니다.
 */
export async function sendRecommendFeedback(
  recommendationToken: string,
  body: { satisfaction: Satisfaction; comment?: string },
): Promise<void> {
  await http.post(
    `/recommendations/natural-language/${recommendationToken}/feedback`,
    body,
  )
}

/** `GET /recommendations/personalized` 의 응답 (`PersonalizedRecommendationResponse`) */
interface PersonalRecommendationResponse {
  recommendationToken: string
  recommendation: {
    perfumeId: number
    name: string
    imageUrl: string | null
    reason: string
  }
}

/**
 * 서버가 "추천할 수 없다" 고 답하는 코드 가운데 **다시 물어도 같은 것**. 화면은 이 둘을 오류가 아니라
 * 결과로 받습니다(PersonalRecommendationResult).
 */
const PERSONAL_NONE_CODES = new Set([
  // 점수가 0 을 넘는 향수가 없습니다. 빈 결과도 모아 두어서, 적합도를 매기거나 향수를 더 보기 전까지 같습니다
  'RECOMMENDATION_NOT_FOUND',
  // 후보를 다시 셈하다 실패했는데 모아 둔 후보도 없습니다
  'RECOMMENDATION_REFRESH_FAILED',
])

/**
 * REC-12 · REC-13 개인화 맞춤 추천 — 진열대의 추천 편지 한 통(S15P21E203-243 · -419).
 *
 * 로그인이 필요합니다. 진열대가 비어 있어도 됩니다 — 취향 테스트만으로도 고릅니다. 반대로 **취향
 * 테스트를 안 했으면 진열대가 가득해도 400** 입니다. 그래서 "진열대에 몇 병 이상" 으로 부를지 가리지
 * 않고 부른 뒤 답을 봅니다.
 *
 * NOTE: 부르기만 해서는 노출이 남지 않습니다. 화면에 실제로 보였을 때 `recordPersonalExposure` 를
 * 따로 부르세요 — 그래야 본 병이 사흘 동안 뽑기에서 빠져 다음에 다른 병이 옵니다.
 * NOTE: **409**(같은 사람의 후보를 다시 셈하는 중)는 잠깐 뒤에 다시 물으면 됩니다 — 던져서 쿼리가
 * 다시 묻게 둡니다(personalRecommendationQuery 의 retry).
 * NOTE: 진열대에 이미 있는 향수를 거르는 일은 추천 엔진의 몫입니다(보유 중만 빠집니다 — 시향 · 희망은
 * 추천될 수 있습니다). 화면에서 거르면 "추천을 받았는데 다 걸러져 0개" 를 화면이 떠안습니다.
 */
export async function getPersonalRecommendation(): Promise<PersonalRecommendationResult> {
  try {
    const { data } = await http.get<PersonalRecommendationResponse>(
      '/recommendations/personalized',
    )
    return {
      status: 'ready',
      recommendation: {
        recommendationToken: data.recommendationToken,
        ...data.recommendation,
      },
    }
  } catch (error) {
    if (isApiError(error)) {
      if (error.code === 'RECOMMENDATION_TASTE_TEST_REQUIRED') {
        return { status: 'needs-taste-test' }
      }
      if (PERSONAL_NONE_CODES.has(error.code)) return { status: 'none' }
    }
    throw error
  }
}

/**
 * 추천 편지가 화면에 **실제로 보였다**고 알립니다(S15P21E203-419). 204 이고, 같은 손잡이로 또 보내도
 * 204 이며 두 번 세지 않습니다.
 *
 * 받은 뒤 10분이 지난 손잡이 · 남의 손잡이는 404 인데, 보이는 쪽에서 할 일이 없어 화면은 조용히
 * 넘깁니다 — 기록이 한 번 빠질 뿐 추천은 그대로입니다.
 *
 * NOTE: **`withDevFallback` 을 쓰지 않습니다.** 쓰기를 대체값으로 덮으면 남지 않은 기록을 남긴 것처럼
 * 보입니다(sendRecommendFeedback 과 같은 까닭).
 */
export async function recordPersonalExposure(
  recommendationToken: string,
): Promise<void> {
  await http.post(
    `/recommendations/personalized/${recommendationToken}/exposure`,
  )
}
