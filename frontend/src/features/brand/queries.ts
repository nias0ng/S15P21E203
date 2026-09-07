import { queryOptions } from '@tanstack/react-query'

import { getBrands } from './api'
import type { BrandSearchParams } from './types'

export const brandKeys = {
  all: ['brands'] as const,
  lists: () => [...brandKeys.all, 'list'] as const,
  list: (params: BrandSearchParams) => [...brandKeys.lists(), params] as const,
}

export const brandListQuery = (params: BrandSearchParams) =>
  queryOptions({
    queryKey: brandKeys.list(params),
    queryFn: () => getBrands(params),
  })
