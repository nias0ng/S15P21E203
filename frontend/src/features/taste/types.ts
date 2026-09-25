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
}

export interface ScentVectorsResponse {
  perfumes: {
    perfumeId: number
    rank: number
    families: Record<string, number>
  }[]
}

export type TasteMatchMode = 'NORMAL' | 'RARE' | 'NO_OVERLAP'

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
