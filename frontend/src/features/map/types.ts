/**
 * 향 지도 도메인 타입 (와이어프레임 A01 · A02 · A03 — MAP-01 ~ MAP-24)
 */

/** 향 계열 구역. 와이어프레임 A01 의 여섯 구역입니다. */
export const SCENT_REGIONS = [
  { id: 'WOODY', label: '우디' },
  { id: 'FLORAL', label: '플로럴' },
  { id: 'CITRUS', label: '시트러스' },
  { id: 'AMBER', label: '앰버' },
  { id: 'FRESH', label: '프레시' },
  { id: 'SPICY', label: '스파이시' },
] as const

export type ScentRegionId = (typeof SCENT_REGIONS)[number]['id']

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
 * 향해 일지 한 줄 (MAP-24).
 *
 * 와이어프레임 주석: "취향 변화가 아니라 배가 지나온 자리를 적는다 ·
 * 다른 향 구역으로 들어갈 때마다 '○○ 구역 진입' 한 줄이 쌓인다".
 * 진입 줄을 누르면 그 구역에서 조회했던 향수가 펼쳐집니다(폴더블).
 */
export interface VoyageLogEntry {
  entryId: number
  /** MM.DD 표기용 ISO */
  enteredAt: string
  region: ScentRegionId
  /** 그 구역에서 조회했던 향수들 */
  visited: { perfumeId: number; name: string }[]
}
