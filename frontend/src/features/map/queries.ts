import { queryOptions } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

import { getMapPoints, getTasteArea, getVoyageLog } from './api'
import { loadMapPerfumes } from './mapPerfumes'

export const mapKeys = {
  all: ['map'] as const,
  points: () => [...mapKeys.all, 'points'] as const,
  perfumes: () => [...mapKeys.all, 'perfumes'] as const,
  voyageLog: () => [...mapKeys.all, 'voyage-log'] as const,
  tasteArea: () => [...mapKeys.all, 'taste-area'] as const,
}

export const mapPointsQuery = () =>
  queryOptions({ queryKey: mapKeys.points(), queryFn: getMapPoints })

/**
 * 지도에 떠 있는 향수 200개 (메인의 일반 검색 대상).
 *
 * 서버가 아니라 **엔진과 같은 생성 파일**을 읽습니다. 배포된 파일이라 세션 중에
 * 바뀌지 않으므로 다시 받지 않습니다 — 그래도 쿼리로 감싸는 이유는 받아 오는
 * 동안의 로딩 · 실패를 화면이 다른 데이터와 같은 방식으로 다루기 위해서입니다.
 */
export const mapPerfumesQuery = () =>
  queryOptions({
    queryKey: mapKeys.perfumes(),
    queryFn: loadMapPerfumes,
    staleTime: Infinity,
  })

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
