/**
 * 향 지도 도메인 타입 (와이어프레임 A01 · A02 · A03 — MAP-01 ~ MAP-24)
 */

import { type ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 3D 지도에 실제로 떠 있는 향수 한 개 (MAP-01 의 200개).
 *
 * **엔진이 지금 화면에 띄우고 있는 목록** 그대로입니다
 * (`landing/src/perfumes-data.js` · `data/perfume_map_points.csv` 생성물).
 * 향해 일지의 이름을 3D 카드 · 부표와 같은 표기로 채우는 재료라 엔진과 같은 목록이어야 합니다.
 *
 * ⚠️ `fragranticaId` 는 **DB 향수 번호가 아닙니다.** 향수 상세(A10)로 보내려면
 * DB 번호가 필요한데 이 데이터에는 없어서, 지금은 이름으로 향수 검색(A09)에
 * 보냅니다 — 엔진 카드의 [자세히 보기]가 쓰는 길과 같습니다(`ScentScene`).
 */
export interface MapPerfume {
  fragranticaId: number
  /** 한글 이름. 없으면 영문 원명입니다 */
  name: string
  /** 3D 부표 위에 뜨는 짧은 이름 — 긴 제품명을 줄인 것입니다. 없으면 `name` 입니다 */
  label: string
  /** 한글 브랜드. 없으면 영문 원명입니다 */
  brand: string
  /** 영문 원명 — 한글로 못 찾을 때 같이 보여 줍니다 */
  nameEn: string
  brandEn: string
  family: ScentFamilyKey | null
  /** 지도 좌표 (정규화 0~1). DB 향수 번호를 찾는 다리입니다 (`lib/perfumeIdAt`) */
  mx: number
  my: number
}

/**
 * 향해 일지 한 줄 (MAP-24). 취향 변화가 아니라 **배가 지나온 자리**를 적습니다 —
 * 다른 구역에 들어갈 때마다 한 줄이 쌓이고, 그 구역에서 들른 향수가 딸립니다.
 * 화면은 이 줄을 날마다 묶어 해역과 향수를 따로 보여 줍니다 (`lib/voyageLogDays`).
 */
export interface VoyageLogEntry {
  entryId: number
  /** 진입 시각 (ISO · 서버는 UTC 로 줍니다). 화면은 보는 사람의 시간대로 날을 가릅니다 */
  enteredAt: string
  scentRegionId: number
  /** 계열 코드 — 화면은 코드로 이름을 고릅니다 */
  region: ScentFamilyKey
  /** 그 구역에 있는 동안 들른 향수 (같은 향수는 한 번) · 지나가기만 했으면 빈 목록 */
  visited: VoyageLogPerfume[]
}

/**
 * 향해 일지에 들른 향수 한 병.
 *
 * API 는 번호와 이름(DB 원명 · 한국어 이름)만 주고, 나머지는 화면이 3D 지도 데이터로 채웁니다
 * (`lib/mapPerfumeLookup` 의 `withMapPerfumes`). 지도에서 못 찾은 향수는 API 값 그대로라
 * 채우는 칸은 모두 비어 있을 수 있습니다.
 */
interface VoyageLogPerfume {
  perfumeId: number
  /**
   * 일지에 적는 이름. 지도에서 찾았으면 3D 부표 위의 짧은 한글 이름이고, 못 찾았으면 API 의 DB 원명
   * (대개 영문)입니다
   */
  name: string
  /** API 의 한국어 이름(없으면 null). 지도에서 못 찾은 향수의 한국어 화면이 씁니다 */
  nameKo?: string | null
  /** 줄이지 않은 한글 이름 — 마우스를 올리면 보입니다 */
  fullName?: string
  brand?: string
  /** 영문 원명 · 브랜드 — 영어 화면은 짧은 한글 이름 대신 이것을 씁니다 */
  nameEn?: string
  brandEn?: string
  /** 대표 향 계열 — 아이콘 색을 정합니다 */
  family?: ScentFamilyKey | null
}

/**
 * `GET /api/v1/map/exploration-logs` 응답 (백엔드 VoyageLogResponse) — 최근 진입부터.
 * entries 한 줄이 위의 VoyageLogEntry 와 같은 모양입니다 (VoyageLogEntryResponse).
 */
export interface VoyageLogResponse {
  entries: VoyageLogEntry[]
}

/**
 * 향해 일지로 받아 오는 진입 줄 수 — 백엔드가 한 번에 주는 최대입니다 (`ExplorationService.MAX_ENTRIES`).
 *
 * 판은 줄을 날마다 묶어 싣기 때문에, 몇 줄만 받으면 오늘 해역을 몇 번 옮긴 것만으로
 * 지난날이 판에서 사라집니다.
 */
export const VOYAGE_LOG_SIZE = 20

/** 향해 일지 판에 싣는 날 수 — 최근 나흘 */
export const VOYAGE_LOG_DAYS = 4

/** 하루에 보이는 해역 · 향수 수 — 최근 넷. 나머지는 '…' 뒤로 가리고, 올리면 카드로 띄웁니다 */
export const VOYAGE_DAY_SHOWN = 4

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

/**
 * `GET /api/v1/map` 의 향수 한 점 (백엔드 `MapPerfumeResponse`) — 여기서 쓰는 것만.
 *
 * ⚠️⚠️ **이 `perfumeId` 가 DB 번호입니다.** 엔진(`MapPerfume`)이 가진 것은 `fragranticaId` 라
 * 서로 다릅니다. 둘을 잇는 다리가 **좌표**입니다 — `x`·`y` 는 `perfume_map_points.map_x/map_y`
 * 를 그대로 준 값이고, 엔진의 `mx`·`my` 도 같은 CSV 에서 왔습니다 (엔진 불변식 21).
 * 짝짓는 곳은 `lib/perfumeIdAt.ts` 한 곳입니다.
 */
export interface MapPerfumePoint {
  perfumeId: number
  /** 정규화 0~1 — 엔진 `mx` 와 같은 공간 */
  x: number
  /** 정규화 0~1 — 엔진 `my` 와 같은 공간 */
  y: number
}
