import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/** NOTE: 배열 순서가 곧 선택 화면의 타일 순서입니다(가벼운 향 → 무거운 향). */
export {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
} from '@/shared/config/scentFamilies'

export interface ScentFamilyLabel {
  key: ScentFamilyKey
  adjective: string
  name: string
}

export type ScentWeights = Partial<Record<ScentFamilyKey, number>>

export interface ScentVector {
  perfumeId: number
  rank: number
  families: ScentWeights
  /**
   * 그려진 자리가 이름표 조각 안인 계열. 떨어져 나온 작은 조각이나 바다면 null 입니다.
   * NOTE: 가장 센 계열(`GET /map` 의 `scentRegionId`)과 다를 수 있습니다 — 서버가 구역 경계로 판정합니다
   */
  labelRegion: ScentFamilyKey | null
}

export interface ScentVectorsResponse {
  perfumes: {
    perfumeId: number
    rank: number
    families: Record<string, number>
    /** NOTE: 이 값을 싣기 전의 서버는 보내지 않습니다 */
    labelRegionCode?: string | null
  }[]
}

/**
 * `PRIMARY_ONLY` 는 뽑힌 병에 2순위 계열이 없는 경우입니다.
 * 두 계열을 다 가진 병이 없거나, 있어도 1순위 계열 구역 밖에 그려져 있을 때입니다.
 */
export type TasteMatchMode = 'NORMAL' | 'RARE' | 'PRIMARY_ONLY'

/** 취향 테스트 기록. NOTE: 아직 치르지 않은 사람도 `completed: false` 인 200 입니다. */
export interface TasteTestRecord {
  completed: boolean
  picks: string[]
  /** NOTE: `completed` 가 true 여도 null 일 수 있습니다 — 지도를 다시 만들며 빠진 향수입니다 */
  matchedPerfumeId: number | null
  x: number | null
  y: number | null
  completedAt: string | null
}

export interface TasteMatch {
  picks: readonly ScentFamilyKey[]
  perfumeId: number
  mode: TasteMatchMode
}
