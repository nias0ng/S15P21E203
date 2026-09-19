import { http } from '@/shared/api/http'

import { usableLogoUrl } from './logo'
import type {
  Brand,
  BrandDetail,
  BrandSearchParams,
  BrandsResponse,
} from './types'

/**
 * A34 브랜드 목록. 페이지가 없어 **전부가 한 번에** 오고 정렬 · 검색은 서버가
 * 합니다. 로고 주소는 여기서 한 번 거릅니다(`logo.ts`) — 화면마다 거르게 두면
 * 새 화면이 생길 때마다 빠뜨립니다.
 */
export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const { data } = await http.get<BrandsResponse>('/brands', { params })
  return data.brands.map((brand) => ({
    ...brand,
    logoUrl: usableLogoUrl(brand.logoUrl),
  }))
}

/**
 * A34 브랜드 한 곳. 목록에서 골라 쓰지 않는 이유는 크기입니다 — 브랜드가 7,793개라
 * 상세 하나를 그리려고 전체를 받게 됩니다. 없는 브랜드는 404 이고(목록에서 고르던
 * 때는 `null` 이었습니다) 로고는 목록과 같은 규칙으로 거릅니다.
 */
export async function getBrand(brandId: number): Promise<BrandDetail> {
  const { data } = await http.get<BrandDetail>(`/brands/${brandId}`)
  return { ...data, logoUrl: usableLogoUrl(data.logoUrl) }
}
