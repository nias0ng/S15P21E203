import { http } from '@/shared/api/http'

import type {
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSearchResponse,
} from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다. http 인스턴스의 baseURL(VITE_API_BASE_URL)이
// 이미 '/api/v1' 이라, 명세서의 리소스 경로만 적으면 됩니다.
// 명세서 GET /api/v1/perfumes  ->  http.get('/perfumes')

/**
 * COM-05 향수 검색 — 백엔드 GET /api/v1/perfumes
 *
 * 조건(keyword · brand · gender · shelf)은 모두 선택이고 함께 오면 AND 입니다.
 * 하나도 안 보내면 활성 향수 전체가 옵니다.
 *
 * shelf 는 전체 사용자 집계 기준이라 로그인이 필요 없습니다.
 * ⚠️ 백엔드가 수정 중입니다. 현재 구현은 개인 진열대 기준이라 비로그인이면
 * 401 입니다. 집계 기준 수정본이 나오면 이 주석을 지우세요.
 * ⚠️ gender · shelf 에 정의되지 않은 값을 보내면 400 입니다.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  const { data } = await http.get<PerfumeSearchResponse>('/perfumes', {
    params,
  })
  return data
}

/**
 * DTL-01 향수 기본 정보 조회
 *
 * 백엔드에 구현되어 있습니다(S15P21E203-128). 없는 향수는 404 이고
 * ApiError 의 code 는 'PERFUME_NOT_FOUND' 입니다.
 *
 * 응답의 brand 는 객체({ brandId, name }), images 는 배열입니다. 검색 응답과
 * 모양이 달라 PerfumeDetail 은 PerfumeSummary 를 상속하지 않습니다.
 *
 * ⚠️ 향조·후기 통계는 상세에 없습니다. 별도 엔드포인트로 각각의 이슈에서 붙습니다.
 */
export async function getPerfumeDetail(perfumeId: number) {
  const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
  return data
}
