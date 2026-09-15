import { http } from '@/shared/api/http'

import type { Brand, BrandSearchParams, BrandsResponse } from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/**
 * A34 브랜드 목록. 로그인이 필요 없습니다.
 *
 * 페이지가 없어 **전부가 한 번에** 옵니다. 정렬 · 검색은 서버가 합니다 — 화면에서
 * 다시 거르면 같은 일을 두 번 하는 데다 정렬 규칙이 서버와 어긋납니다.
 *
 * 응답 껍데기(`{ brands }`)를 벗겨 배열만 돌려줍니다. 나중에 페이지가 붙으면
 * 그때 껍데기째 돌려주도록 이 함수만 고치면 됩니다.
 */
export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const { data } = await http.get<BrandsResponse>('/brands', { params })
  return data.brands
}
