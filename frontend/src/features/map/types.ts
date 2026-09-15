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
  /** MM.DD 표기용 ISO */
  enteredAt: string
  region: ScentRegionId
  /** 그 구역에서 조회했던 향수들 */
  visited: { perfumeId: number; name: string }[]
}
