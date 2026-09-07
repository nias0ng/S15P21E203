import { http } from '@/shared/api/http'

import type {
  Page,
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSummary,
} from './types'

/** COM-05 향수 검색 */
export async function searchPerfumes(params: PerfumeSearchParams) {
  const { data } = await http.get<Page<PerfumeSummary>>('/perfumes', { params })
  return data
}

/** DTL-01 향수 기본 정보 조회 */
export async function getPerfumeDetail(perfumeId: number) {
  const { data } = await http.get<PerfumeDetail>(`/perfumes/${perfumeId}`)
  return data
}
