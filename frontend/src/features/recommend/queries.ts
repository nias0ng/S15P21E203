import { queryOptions } from '@tanstack/react-query'

import { getRecommendation } from './api'

export const recommendKeys = {
  all: ['recommend'] as const,
  byQuery: (query: string) => [...recommendKeys.all, query] as const,
}

export const recommendationQuery = (query: string) =>
  queryOptions({
    queryKey: recommendKeys.byQuery(query),
    queryFn: () => getRecommendation(query),
  })
