import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import { placeholderDetail, placeholderSearch } from './placeholder'
import type {
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSearchResponse,
} from './types'

/**
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다.
 *
 * **요청이 백엔드에 닿지도 못했을 때만**(status 0 · 502~504) 끼어듭니다.
 * 400 · 401 · 404 처럼 백엔드가 대답한 오류는 그대로 올려보냅니다 — 그것까지
 * 삼키면 진짜 버그가 자리표시자에 가려집니다. 운영에서는 끼어들지 않습니다.
 *
 * 지울 때는 이 함수와 `placeholder.ts` 를 함께 지우세요.
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
      '[perfume] 백엔드에 닿지 못해 개발용 대체 데이터를 씁니다. 실제 값이 아닙니다.',
    )
    return fallback()
  }
}

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/**
 * COM-05 향수 검색. 조건은 모두 선택이고 함께 오면 AND 입니다.
 *
 * ⚠️ shelf 는 백엔드 수정 중 — 지금은 개인 진열대 기준이라 비로그인이면 401 입니다.
 * ⚠️ gender · shelf 에 정의되지 않은 값을 보내면 400 입니다.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<PerfumeSearchResponse>('/perfumes', {
        params,
      })
      return data
    },
    () => placeholderSearch(params),
  )
}

/**
 * DTL-01 향수 기본 정보 조회. 없는 향수는 404 `PERFUME_NOT_FOUND` 입니다.
 *
 * ⚠️ 향조·후기 통계는 상세에 없습니다. 별도 엔드포인트로 각각의 이슈에서 붙습니다.
 */
export async function getPerfumeDetail(perfumeId: number) {
  return withDevFallback(
    async () => {
      const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
      return data
    },
    () => placeholderDetail(perfumeId),
  )
}
