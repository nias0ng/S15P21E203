import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import {
  VOYAGE_LOG_SIZE,
  type ExplorationMove,
  type ExplorationState,
  type MapPerfumePoint,
  type MapPoint,
  type VoyageLogEntry,
  type VoyageLogResponse,
} from './types'

/**
 * ⚠️ 백엔드 향 지도 API 가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다.
 *
 * 좌표계도 임시입니다. 백엔드 perfume_map_points 와 scent_regions 가 정해지면
 * x · y 의 의미부터 맞춰야 합니다.
 */
export async function getMapPoints(): Promise<MapPoint[]> {
  return PLACEHOLDER_POINTS
}

/**
 * ⚠️ 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다 — `features/perfume/api.ts` 와 같은 규칙입니다.
 * **요청이 백엔드에 닿지도 못했을 때만**(status 0 · 502~504) 끼어들고, 401 처럼 백엔드가 대답한 오류는
 * 그대로 올려보냅니다. 운영에서는 끼어들지 않습니다.
 *
 * ⚠️ 두 번째 사용처라 `shared/api` 로 올릴 후보입니다 (frontend/CLAUDE.md 의 공용화 시점).
 * perfume 도메인을 같이 고쳐야 해서 D 갈래에서는 복사해 두고, 통합할 때 올립니다.
 */
async function withDevFallback<T>(
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unreachable =
      isApiError(error) &&
      (error.status === 0 || (error.status >= 502 && error.status <= 504))

    if (!env.isDev || !unreachable) throw error

    console.warn(
      '[map] 백엔드에 닿지 못해 개발용 대체 향해 일지를 씁니다. 실제 값이 아닙니다.',
    )
    return fallback()
  }
}

/**
 * MAP-24 향해 일지 — 최근 해역 진입부터 `VOYAGE_LOG_SIZE` 줄. 판은 이것을 날마다 묶어 싣습니다.
 * 로그인해야 읽을 수 있습니다 (비로그인 401 — 화면은 로그인 안내를 띄웁니다).
 *
 * 일지는 `moveExploration()` 이 쌓습니다 — 엔진이 배의 해역이 바뀔 때마다 알려 줍니다(아래).
 */
export async function getVoyageLog(): Promise<VoyageLogEntry[]> {
  return withDevFallback(
    async () => {
      const { data } = await http.get<VoyageLogResponse>(
        '/map/exploration-logs',
        { params: { size: VOYAGE_LOG_SIZE } },
      )
      return data.entries
    },
    () => PLACEHOLDER_LOG,
  )
}

/**
 * MAP-24 배를 옮깁니다 — 향해 일지가 쌓이는 유일한 길입니다 (2026-09-18).
 *
 * 엔진이 배의 해역이 바뀔 때와 향수를 고를 때 알려 주고(`landing/src/host.js` `hostMove`),
 * **기록할지는 서버가 정합니다** — 향수를 고른 이동은 언제나, 빈 바다로 간 이동은 향 영역이
 * 바뀐 경우에만 남습니다. 그래서 화면은 "언제 한 줄이 되는가" 를 알 필요가 없습니다.
 *
 * ⚠️ 로그인하지 않아도 부릅니다 — 비회원도 지도를 탐색할 수 있어야 해서 배는 움직이고,
 * 서버가 `updatedAt` 을 비워 "남기지 않았다" 를 알려 줍니다(401 이 아닙니다).
 */
/**
 * MAP-24 **배가 지금 떠 있는 자리** (백엔드 `GET /api/v1/map/exploration/me`).
 *
 * 메인에 들어올 때 배를 거기에 돌려놓는 데 씁니다 — 컨트롤러 주석이 그대로 이 용도입니다
 * (`docs/배-자리와-향해일지-0921.md` §A-2).
 *
 * ⚠️ 한 번도 안 움직였으면 **세 필드가 모두 null 인 200** 입니다 (404 가 아닙니다 — 처음 온
 * 사람을 오류로 다루지 않으려고). 비로그인은 401 입니다.
 * ⚠️ 좌표는 **정규화 0~1** 입니다 (엔진 `scentmap.toNorm()` 과 같은 공간).
 */
export async function getExplorationState(): Promise<ExplorationState> {
  const { data } = await http.get<ExplorationState>('/map/exploration/me')
  return data
}

/**
 * 지도에 찍히는 향수 200개의 **DB 번호와 좌표** (백엔드 `GET /api/v1/map`).
 *
 * 쓰는 곳은 하나입니다 — 엔진이 넘긴 좌표로 DB 향수 번호를 찾는 색인
 * (`lib/perfumeIdAt`). 엔진 데이터에는 그 번호가 없기 때문입니다.
 *
 * ⚠️ 로그인이 필요 없습니다. 조건도 없어 세션 중에 바뀌지 않습니다 — 쿼리에서 `staleTime` 을 길게 둡니다.
 * ⚠️ 응답에는 `regions` 와 이름 · 이미지도 딸려 오지만 여기서는 **좌표와 번호만** 남깁니다.
 */
export async function getMapPerfumePoints(): Promise<MapPerfumePoint[]> {
  const { data } = await http.get<{ perfumes: MapPerfumePoint[] }>('/map')
  return data.perfumes.map(({ perfumeId, x, y }) => ({ perfumeId, x, y }))
}

export async function moveExploration(
  move: ExplorationMove,
): Promise<ExplorationState> {
  const { data } = await http.put<ExplorationState>('/map/exploration/me', move)
  return data
}

/**
 * MAP-08 내 취향 영역. 와이어프레임의 "검은 원 = 나를 위한 추천" 입니다.
 * 개인화 추천(REC-12 · REC-13)은 별도 화면 없이 이 영역으로 표시합니다.
 */
export async function getTasteArea() {
  return { x: 38, y: 44, radius: 16 }
}

/** ⚠️ 백엔드 API 가 붙으면 아래 배열들을 통째로 지우세요. */
const PLACEHOLDER_POINTS: MapPoint[] = [
  {
    perfumeId: 1,
    name: '조 말론 우드 세이지',
    brand: '조 말론 런던',
    region: 'WOODY',
    x: 32,
    y: 38,
  },
  {
    perfumeId: 2,
    name: '딥디크 오르페옹',
    brand: '딥디크',
    region: 'WOODY',
    x: 41,
    y: 47,
  },
  {
    perfumeId: 3,
    name: '르 라보 상탈 33',
    brand: '르 라보',
    region: 'WOODY',
    x: 27,
    y: 52,
  },
  {
    perfumeId: 4,
    name: '바이레도 블랑쉬',
    brand: '바이레도',
    region: 'FLORAL',
    x: 62,
    y: 26,
  },
  {
    perfumeId: 5,
    name: '이솝 휘라',
    brand: '이솝',
    region: 'FLORAL',
    x: 71,
    y: 33,
  },
  {
    perfumeId: 6,
    name: '아쿠아 디 파르마 콜로니아',
    brand: '아쿠아 디 파르마',
    region: 'CITRUS',
    x: 18,
    y: 20,
  },
  {
    perfumeId: 7,
    name: '조 말론 잉글리시 페어',
    brand: '조 말론 런던',
    region: 'CITRUS',
    x: 26,
    y: 15,
  },
  {
    perfumeId: 8,
    name: '톰 포드 토바코 바닐',
    brand: '톰 포드',
    region: 'AMBER',
    x: 78,
    y: 66,
  },
  {
    perfumeId: 9,
    name: '바이레도 짐나스',
    brand: '바이레도',
    region: 'GREEN',
    x: 15,
    y: 72,
  },
  {
    perfumeId: 10,
    name: '딥디크 도손',
    brand: '딥디크',
    region: 'FLORAL',
    x: 58,
    y: 78,
  },
]

const PLACEHOLDER_LOG: VoyageLogEntry[] = [
  {
    entryId: 1,
    enteredAt: '2026-08-24T00:00:00Z',
    scentRegionId: 6,
    region: 'WOODY',
    visited: [
      { perfumeId: 1, name: '조 말론 우드 세이지' },
      { perfumeId: 3, name: '르 라보 상탈 33' },
      { perfumeId: 2, name: '딥디크 오르페옹' },
    ],
  },
  {
    entryId: 2,
    enteredAt: '2026-08-19T00:00:00Z',
    scentRegionId: 1,
    region: 'CITRUS',
    visited: [{ perfumeId: 6, name: '아쿠아 디 파르마 콜로니아' }],
  },
  {
    entryId: 3,
    enteredAt: '2026-08-11T00:00:00Z',
    scentRegionId: 3,
    region: 'FLORAL',
    visited: [{ perfumeId: 4, name: '바이레도 블랑쉬' }],
  },
]
