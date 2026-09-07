import { queryOptions } from '@tanstack/react-query'

import { getShelfItems } from './api'

export const shelfKeys = {
  all: ['shelf'] as const,
  items: () => [...shelfKeys.all, 'items'] as const,
}

export const shelfItemsQuery = () =>
  queryOptions({
    queryKey: shelfKeys.items(),
    queryFn: getShelfItems,
  })
