/**
 * 향 지도 도메인 타입 (와이어프레임 A01 · A02 · A03 — MAP-01 ~ MAP-24)
 */

import {
  SCENT_FAMILY_KEYS,
  SCENT_FAMILY_NAMES,
  type ScentFamilyKey,
} from '@/shared/config/scentFamilies'

/**
 * 향 계열 구역 **아홉 개**. 지도를 나누는 기준이 곧 향 계열이라 공용 어휘를 그대로
 * 씁니다.
 *
 * 전에는 여기 여섯 개가 따로 적혀 있었고 그중 `FRESH` · `SPICY` 는 **어디에도 없는
 * 값**이었습니다. 실제 지도 데이터가 들어오기 전에 손으로 적어 둔 것이 남아 있던
 * 것입니다 — 3D 엔진도 백엔드도 아래 아홉을 씁니다.
 */
export const SCENT_REGIONS = SCENT_FAMILY_KEYS.map((id) => ({
  id,
  label: SCENT_FAMILY_NAMES[id],
}))

/** 구역 = 향 계열입니다. 이름만 도메인 어휘로 바꿔 둡니다. */
export type ScentRegionId = ScentFamilyKey

/**
 * 향 계열 아홉 — 백엔드 `scent_regions.code` 의 `display_order` 순서 · 3D 엔진 CONFIG.families 와 같은 코드.
 * 향해 일지처럼 백엔드 지도 API 를 읽는 곳은 이것을 씁니다.
 * ⚠ develop 병합(2026-09-16)으로 위의 SCENT_REGIONS 도 공용 어휘(`shared/config/scentFamilies`)의 아홉이 됐습니다 —
 *   코드 · 이름이 이 목록과 같아 두 벌입니다. 이 목록을 공용 어휘로 합치는 것은 따로 합니다.
 */
export const SCENT_FAMILIES = [
  { code: 'CITRUS', label: '시트러스' },
  { code: 'FRUITY', label: '프루티' },
  { code: 'FLORAL', label: '플로럴' },
  { code: 'GREEN', label: '그린' },
  { code: 'AQUATIC', label: '아쿠아틱' },
  { code: 'WOODY', label: '우디' },
  { code: 'AMBER', label: '앰버' },
  { code: 'GOURMAND', label: '구르망' },
  { code: 'MUSK', label: '머스크' },
] as const

export type ScentFamilyCode = (typeof SCENT_FAMILIES)[number]['code']

/**
 * 지도 위의 향수 한 점.
 *
 * x · y 는 지도 좌표계(0~100) 기준 비율입니다. 실제 좌표 체계는 백엔드의
 * perfume_map_points 가 정해지면 그 값으로 바꿔야 합니다.
 */
export interface MapPoint {
  perfumeId: number
  name: string
  brand: string
  region: ScentRegionId
  x: number
  y: number
}

/**
 * 3D 지도에 실제로 떠 있는 향수 한 개 (MAP-01 의 200개).
 *
 * `MapPoint` 와 다릅니다. `MapPoint` 는 **백엔드 지도 API** 가 줄 점이고(아직
 * 자리표시자), 이쪽은 **엔진이 지금 화면에 띄우고 있는 목록** 그대로입니다
 * (`landing/src/perfumes-data.js` · `data/perfume_map_points.csv` 생성물).
 * 메인의 일반 검색이 찾는 대상이라 엔진과 같은 목록이어야 합니다.
 *
 * ⚠️ `fragranticaId` 는 **DB 향수 번호가 아닙니다.** 향수 상세(A10)로 보내려면
 * DB 번호가 필요한데 이 데이터에는 없어서, 지금은 이름으로 향수 검색(A09)에
 * 보냅니다 — 엔진 카드의 [자세히 보기]가 쓰는 길과 같습니다(`ScentScene`).
 */
export interface MapPerfume {
  fragranticaId: number
  /** 한글 이름. 없으면 영문 원명입니다 */
  name: string
  /** 한글 브랜드. 없으면 영문 원명입니다 */
  brand: string
  /** 영문 원명 — 한글로 못 찾을 때 같이 보여 줍니다 */
  nameEn: string
  brandEn: string
  family: ScentRegionId | null
  /** 화해 지도 기준 순위 1~200. 검색 결과를 이 순서로 냅니다 */
  rank: number
}

/** 지도에서 지금 보고 있는 범위. 미니맵이 이 값을 사각형으로 그립니다. */
export interface Viewport {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 향해 일지 한 줄 (MAP-24). 취향 변화가 아니라 **배가 지나온 자리**를 적습니다 —
 * 다른 구역에 들어갈 때마다 한 줄이 쌓이고, 누르면 그때 본 향수가 펼쳐집니다.
 */
export interface VoyageLogEntry {
  entryId: number
  /** 진입 시각 (ISO · 오프셋 포함). 화면은 MM.DD 만 씁니다 */
  enteredAt: string
  scentRegionId: number
  /** 계열 코드 — 화면은 코드로 이름을 고릅니다 */
  region: ScentFamilyCode
  /** 그 구역에 있는 동안 들른 향수 (같은 향수는 한 번) · 지나가기만 했으면 빈 목록 */
  visited: { perfumeId: number; name: string }[]
}

/**
 * `GET /api/v1/map/exploration-logs` 응답 (백엔드 VoyageLogResponse) — 최근 진입부터.
 * entries 한 줄이 위의 VoyageLogEntry 와 같은 모양입니다 (VoyageLogEntryResponse).
 */
export interface VoyageLogResponse {
  entries: VoyageLogEntry[]
}

/** 향해 일지에 싣는 진입 줄 수 — 최근 다섯 (2026-09-16 사용자). 백엔드에도 이만큼만 달라고 합니다 */
export const VOYAGE_LOG_SIZE = 5

/**
 * `PUT /api/v1/map/exploration/me` 요청 (백엔드 ExplorationMoveRequest) — 배를 옮깁니다.
 *
 * 향수를 골랐으면 `perfumeId` 를, 빈 바다를 골랐으면 `x` · `y` 를 보냅니다. 향수를 고른
 * 경우 좌표는 서버가 그 향수의 지도 좌표로 채우므로 보내지 않아도 됩니다. 둘 다 없으면 400 입니다.
 *
 * ⚠️ `x` · `y` 는 **정규화 좌표**입니다 (백엔드 `perfume_map_points` · 엔진 `scentmap.toNorm()` 과 같은 공간).
 * 엔진의 월드 좌표를 그대로 보내면 서버가 지도 밖으로 읽습니다.
 */
export interface ExplorationMove {
  perfumeId?: number | null
  x?: number
  y?: number
}

/**
 * `PUT` · `GET /api/v1/map/exploration/me` 응답 (백엔드 ExplorationStateResponse) — 옮긴 뒤의 자리.
 *
 * ⚠️ 셋 다 null 일 수 있습니다 — 한 번도 움직인 적이 없으면 그렇습니다(200). 그리고 **비로그인이면
 * `updatedAt` 이 비어 나옵니다** — 배는 움직이되 남기지 않았다는 표시입니다(컨트롤러 주석).
 */
export interface ExplorationState {
  x: number | null
  y: number | null
  updatedAt: string | null
}
