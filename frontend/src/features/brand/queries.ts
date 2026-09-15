import { queryOptions } from '@tanstack/react-query'

import { getBrandDetail, getBrandPerfumes, getBrands } from './api'
import type { BrandSearchParams } from './types'

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (params: BrandSearchParams) => [...brandKeys.lists(), params] as const,
  details: () => [...brandKeys.all, 'detail'] as const,
  detail: (brandId: number) => [...brandKeys.details(), brandId] as const,
  perfumes: (brandId: number) =>
    [...brandKeys.detail(brandId), 'perfumes'] as const,
}

export const brandListQuery = (params: BrandSearchParams) =>
  queryOptions({
    queryKey: brandKeys.list(params),
    queryFn: () => getBrands(params),
  })

export const brandDetailQuery = (brandId: number) =>
  queryOptions({
    queryKey: brandKeys.detail(brandId),
    queryFn: () => getBrandDetail(brandId),
  })

export const brandPerfumesQuery = (brandId: number) =>
  queryOptions({
    queryKey: brandKeys.perfumes(brandId),
    queryFn: () => getBrandPerfumes(brandId),
  })
