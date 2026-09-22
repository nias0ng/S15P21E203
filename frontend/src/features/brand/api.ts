import { http } from '@/shared/api/http'

import { usableLogoUrl } from './logo'
import type {
  Brand,
  BrandDetail,
  BrandSearchParams,
  BrandsResponse,
} from './types'

/** 페이지가 없어 전부가 한 번에 옵니다. 정렬 · 검색은 서버가 합니다 */
export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const { data } = await http.get<BrandsResponse>('/brands', { params })
  return data.brands.map((brand) => ({
    ...brand,
    logoUrl: usableLogoUrl(brand.logoUrl),
  }))
}

/** 없는 브랜드는 `null` 이 아니라 404 입니다 */
export async function getBrand(brandId: number): Promise<BrandDetail> {
  const { data } = await http.get<BrandDetail>(`/brands/${brandId}`)
  return { ...data, logoUrl: usableLogoUrl(data.logoUrl) }
}
