import { http } from '@/shared/api/http'

import type {
  Page,
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSummary,
} from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다. http 인스턴스의 baseURL(VITE_API_BASE_URL)이
// 이미 '/api/v1' 이라, 명세서의 리소스 경로만 적으면 됩니다.
// 명세서 GET /api/v1/perfumes  ->  http.get('/perfumes')

/**
 * COM-05 향수 검색 — 백엔드 GET /api/v1/perfumes
 *
 * ⚠️ 응답의 각 항목에 thumbnailUrl, scentFamily 가 아직 없습니다. PerfumeSummary 주석 참고.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  const { data } = await http.get<Page<PerfumeSummary>>('/perfumes', { params })
  return data
}

/**
 * DTL-01 향수 기본 정보 조회
 *
 * ⚠️ 이 엔드포인트는 백엔드에 아직 구현되어 있지 않습니다 (PerfumeController 에는 검색만 있음).
 * 호출하면 404 가 오고 ApiError 의 code 는 'NOT_FOUND' 입니다.
 * 상세 페이지 작업 전에 백엔드 이슈 진행 상황을 먼저 확인하세요.
 */
export async function getPerfumeDetail(perfumeId: number) {
  const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
  return data
}
