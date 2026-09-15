import { queryOptions } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

import { getMapPoints, getTasteArea, getVoyageLog } from './api'

export const mapKeys = {
  all: ['map'] as const,
  points: () => [...mapKeys.all, 'points'] as const,
  voyageLog: () => [...mapKeys.all, 'voyage-log'] as const,
  tasteArea: () => [...mapKeys.all, 'taste-area'] as const,
}

export const mapPointsQuery = () =>
  queryOptions({ queryKey: mapKeys.points(), queryFn: getMapPoints })

/** 향해 일지 — 비로그인(401)은 다시 불러도 같은 답이라 재시도하지 않습니다 */
export const voyageLogQuery = () =>
  queryOptions({
    queryKey: mapKeys.voyageLog(),
    queryFn: getVoyageLog,
    retry: (failureCount, error) =>
      !(isApiError(error) && error.status === 401) && failureCount < 3,
  })

export const tasteAreaQuery = () =>
  queryOptions({ queryKey: mapKeys.tasteArea(), queryFn: getTasteArea })
