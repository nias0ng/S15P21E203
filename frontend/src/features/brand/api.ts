import { http } from '@/shared/api/http'

import { usableLogoUrl } from './logo'
import type {
  Brand,
  BrandDetail,
  BrandSearchParams,
  BrandsResponse,
} from './types'

export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const { data } = await http.get<BrandsResponse>('/brands', { params })
  return data.brands.map((brand) => ({
    ...brand,
    logoUrl: usableLogoUrl(brand.logoUrl),
  }))
}

export async function getBrand(brandId: number): Promise<BrandDetail> {
  const { data } = await http.get<BrandDetail>(`/brands/${brandId}`)
  return { ...data, logoUrl: usableLogoUrl(data.logoUrl) }
}
