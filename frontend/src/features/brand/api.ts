import { http } from '@/shared/api/http'

import { usableLogoUrl } from './logo'
import type {
  Brand,
  BrandDetail,
  BrandSearchParams,
  BrandsResponse,
} from './types'

/**
 * A34 브랜드 목록. 로그인이 필요 없습니다.
 *
 * 페이지가 없어 **전부가 한 번에** 옵니다. 정렬 · 검색은 서버가 합니다 — 화면에서
 * 다시 거르면 같은 일을 두 번 하는 데다 정렬 규칙이 서버와 어긋납니다.
 *
 * 응답 껍데기(`{ brands }`)를 벗겨 배열만 돌려줍니다. 나중에 페이지가 붙으면
 * 그때 껍데기째 돌려주도록 이 함수만 고치면 됩니다.
 *
 * 로고 주소는 여기서 한 번 거릅니다(`logo.ts`). 화면마다 거르게 두면 새 화면이 생길
 * 때마다 빠뜨리고, 그러면 그 화면만 깨진 아이콘이 뜹니다. 로고 사진을 다시 모아
 * 올리면 이 `map` 과 `logo.ts` 를 함께 지웁니다.
 */
export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const { data } = await http.get<BrandsResponse>('/brands', { params })
  return data.brands.map((brand) => ({
    ...brand,
    logoUrl: usableLogoUrl(brand.logoUrl),
  }))
}

/**
 * A34 브랜드 한 곳. 로그인이 필요 없습니다.
 *
 * 목록에서 골라 쓰지 않는 이유는 크기입니다 — 브랜드가 7,793개라, 상세 화면 하나를
 * 그리려고 전체 목록을 받게 됩니다.
 *
 * 없는 브랜드(또는 내려간 브랜드)는 404 입니다. 목록에서 골라내던 때는 `null` 이라
 * 화면이 "찾을 수 없습니다" 를 그렸는데, 이제 그 판단을 오류 상태로 합니다.
 *
 * 로고는 목록과 같은 규칙으로 한 번 거릅니다(`logo.ts`).
 */
export async function getBrand(brandId: number): Promise<BrandDetail> {
  const { data } = await http.get<BrandDetail>(`/brands/${brandId}`)
  return { ...data, logoUrl: usableLogoUrl(data.logoUrl) }
}
