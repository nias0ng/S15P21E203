import { queryOptions } from '@tanstack/react-query'

import { isApiError } from '@/shared/api/http'

import { getExplorationState, getMapPerfumePoints, getVoyageLog } from './api'
import { loadMapPerfumes } from './mapPerfumes'

export const mapKeys = {
  all: ['map'] as const,
  perfumes: () => [...mapKeys.all, 'perfumes'] as const,
  perfumePoints: () => [...mapKeys.all, 'perfume-points'] as const,
  exploration: () => [...mapKeys.all, 'exploration'] as const,
  voyageLog: () => [...mapKeys.all, 'voyage-log'] as const,
}

/**
 * 배가 지금 떠 있는 자리 — 메인에 들어올 때 배를 돌려놓는 데 씁니다 (MAP-24).
 *
 * ⚠️ 비로그인(401)은 다시 불러도 같은 답이라 재시도하지 않습니다 — 향해 일지와 같은 규칙입니다.
 * ⚠️ `staleTime` 을 두지 않습니다. 다른 화면에 갔다 오는 사이에 **우리가 자리를 저장했기 때문에**,
 *   캐시된 옛 자리를 쓰면 배가 뒤로 돌아갑니다.
 */
export const explorationStateQuery = () =>
  queryOptions({
    queryKey: mapKeys.exploration(),
    queryFn: getExplorationState,
    retry: (failureCount, error) =>
      !(isApiError(error) && error.status === 401) && failureCount < 3,
  })

/**
 * 지도 향수 200개의 DB 번호와 좌표 — 엔진 좌표로 향수 번호를 찾는 색인의 재료입니다
 * (`lib/perfumeIdAt`).
 *
 * 조건이 없는 조회라 세션 중에 안 바뀝니다. 지도를 다시 적재해야 바뀌는 값이라 한 시간 둡니다
 * (취향 테스트의 계열 벡터와 같은 성격입니다).
 */
export const mapPerfumePointsQuery = () =>
  queryOptions({
    queryKey: mapKeys.perfumePoints(),
    queryFn: getMapPerfumePoints,
    staleTime: 1000 * 60 * 60,
  })

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
