import { http, isApiError } from '@/shared/api/http'
import { env } from '@/shared/config/env'

import {
  VOYAGE_LOG_SIZE,
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
 * MAP-24 향해 일지 — 최근 해역 진입부터 다섯 줄 (VOYAGE_LOG_SIZE — 판에 싣는 수와 같습니다).
 * 로그인해야 읽을 수 있습니다 (비로그인 401 — 화면은 로그인 안내를 띄웁니다).
 *
 * ⚠️ 일지가 쌓이려면 배를 옮길 때 `PUT /api/v1/map/exploration/me` 를 불러야 합니다 — 아직 엔진이 부르지 않습니다.
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
