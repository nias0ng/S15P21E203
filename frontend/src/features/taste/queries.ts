import { queryOptions } from '@tanstack/react-query'

import { getMyTasteTest, getScentVectors } from './api'

export const tasteKeys = {
  all: ['taste'] as const,
  scentVectors: () => [...tasteKeys.all, 'scent-vectors'] as const,
  mine: () => [...tasteKeys.all, 'mine'] as const,
}

export const myTasteTestQuery = () =>
  queryOptions({
    queryKey: tasteKeys.mine(),
    queryFn: getMyTasteTest,
  })

export const scentVectorsQuery = () =>
  queryOptions({
    queryKey: tasteKeys.scentVectors(),
    queryFn: getScentVectors,
    staleTime: 1000 * 60 * 60,
  })
