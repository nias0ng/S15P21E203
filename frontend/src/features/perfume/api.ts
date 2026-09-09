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
 * ⚠️ 응답의 각 항목에 scentFamily 가 아직 없습니다. PerfumeSummary 주석 참고.
 * thumbnailUrl 은 내려옵니다 — 등록된 이미지가 없는 향수는 null 입니다.
 *
 * ⚠️ 백엔드는 검색어가 없으면 DB 를 조회하지 않고 빈 결과를 돌려줍니다
 * ("검색어가 입력되지 않은 경우 검색을 수행하지 않는다"). 목록 화면에서
 * 검색어 없이 부르면 데이터가 있어도 0건입니다.
 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  const { data } = await http.get<Page<PerfumeSummary>>('/perfumes', { params })
  return data
}

/**
 * DTL-01 향수 기본 정보 조회
 *
 * 백엔드에 구현되어 있습니다(S15P21E203-128). 없는 향수는 404 이고
 * ApiError 의 code 는 'PERFUME_NOT_FOUND' 입니다.
 *
 * ⚠️ 응답은 { perfumeId, name, brand, thumbnailUrl, description } 뿐입니다.
 * 향조·후기 통계는 아직 없어 PerfumeDetail 에서 옵셔널입니다.
 */
export async function getPerfumeDetail(perfumeId: number) {
  const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
  return data
}
