import { queryOptions } from '@tanstack/react-query'

import { getMapPoints, getTasteArea, getVoyageLog } from './api'

export const mapKeys = {
  all: ['map'] as const,
  points: () => [...mapKeys.all, 'points'] as const,
  voyageLog: () => [...mapKeys.all, 'voyage-log'] as const,
  tasteArea: () => [...mapKeys.all, 'taste-area'] as const,
}

export const mapPointsQuery = () =>
  queryOptions({ queryKey: mapKeys.points(), queryFn: getMapPoints })

export const voyageLogQuery = () =>
  queryOptions({ queryKey: mapKeys.voyageLog(), queryFn: getVoyageLog })

export const tasteAreaQuery = () =>
  queryOptions({ queryKey: mapKeys.tasteArea(), queryFn: getTasteArea })
