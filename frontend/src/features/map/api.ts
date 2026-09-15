import type { MapPoint, VoyageLogEntry } from './types'

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

export async function getVoyageLog(): Promise<VoyageLogEntry[]> {
  return PLACEHOLDER_LOG
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
    region: 'CITRUS',
    visited: [{ perfumeId: 6, name: '아쿠아 디 파르마 콜로니아' }],
  },
  {
    entryId: 3,
    enteredAt: '2026-08-11T00:00:00Z',
    region: 'FLORAL',
    visited: [{ perfumeId: 4, name: '바이레도 블랑쉬' }],
  },
]
