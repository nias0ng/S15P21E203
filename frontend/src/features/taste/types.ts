import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/** 취향 테스트 도메인 타입 (TST-03). 판단은 2D 투영 좌표가 아니라 9차원 계열 벡터에서 합니다. */

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

/** 계열별 비중. 합이 1이 아니라(0.2~1.0) `1 - 합` 을 "기타 계열" 로 읽으면 안 됩니다. */
export type ScentWeights = Partial<Record<ScentFamilyKey, number>>

export interface ScentVector {
  perfumeId: number
  /** 국내 선정 순위 1~200. 유사도가 같을 때 이 값이 작은 향수를 씁니다 */
  rank: number
  families: ScentWeights
}

/** `families` 의 키는 `scent_regions.code` 라 열린 문자열입니다 — `api.ts` 가 아는 계열만 남깁니다. */
export interface ScentVectorsResponse {
  perfumes: {
    perfumeId: number
    rank: number
    families: Record<string, number>
  }[]
}

/** 결과 문구가 갈리는 기준. n 은 고른 계열을 모두 가진 향수의 수이고 데이터에서 셉니다. */
export type TasteMatchMode =
  /** n ≥ 2 — 후보가 여럿이라 비율이 가장 가까운 향수가 뽑혔습니다 */
  | 'NORMAL'
  /** n = 1 — 두 향을 함께 담은 향수가 하나뿐입니다 */
  | 'RARE'
  /** n = 0 — 두 향을 함께 담은 향수가 없어 1순위 향수가 뽑혔습니다 */
  | 'NO_OVERLAP'

/** 취향 테스트 기록. NOTE: 아직 치르지 않은 사람도 `completed: false` 인 200 입니다. */
export interface TasteTestRecord {
  completed: boolean
  /** 고른 계열. `[0]` 이 1순위입니다. 안 치렀으면 빈 배열 */
  picks: string[]
  /** NOTE: `completed` 가 true 여도 null 일 수 있습니다 — 지도를 다시 만들며 빠진 향수입니다 */
  matchedPerfumeId: number | null
  /** 결과 향수의 지도 좌표. 0~1 스케일입니다(화면은 100배 해서 씁니다) */
  x: number | null
  y: number | null
  completedAt: string | null
}

export interface TasteMatch {
  /** 고른 계열. `[0]` 이 1순위입니다 */
  picks: readonly ScentFamilyKey[]
  perfumeId: number
  mode: TasteMatchMode
}
