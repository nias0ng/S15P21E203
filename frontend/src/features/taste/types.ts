import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 취향 테스트 도메인 타입 (요구사항 TST-03)
 *
 * 회원가입 직후 온보딩 스텝에서 향 계열을 1~2개 고르면, 향 지도의 출발점이 될
 * 향수 한 개를 정합니다. 판단은 지도의 2D 좌표가 아니라 9차원 계열 벡터에서 합니다.
 * UMAP 투영을 거친 2D 좌표를 평균 내면 고르지 않은 계열 영역에 결과가 찍힐 수 있습니다.
 */

/**
 * 향 계열 9개는 취향 테스트만의 어휘가 아닙니다 — 향 지도가 지도를 이 아홉으로
 * 나누고 향수 검색도 같은 코드를 내려주므로 `shared/config` 에 한 벌만 둡니다.
 *
 * 배열 순서가 곧 선택 화면의 타일 배치 순서입니다(가벼운 향 → 무거운 향).
 */
export {
  SCENT_FAMILY_KEYS,
  type ScentFamilyKey,
} from '@/shared/config/scentFamilies'

/** 화면에 쓰는 계열 이름. 기본은 형용사, 마우스를 올리면 계열명으로 바뀝니다. */
export interface ScentFamilyLabel {
  key: ScentFamilyKey
  /** 기본 표시 — "화사하고 우아한" */
  adjective: string
  /** 호버 · 포커스 시 표시 — "플로럴" */
  name: string
}

/**
 * 계열별 비중. 향수 한 개가 9개 중 1~3개만 값을 갖는 희소 벡터이고,
 * **합이 1이 아닙니다**(0.2~1.0). 정규화하지 않은 값이므로 `1 - 합` 을
 * "기타 계열" 로 해석하면 안 됩니다.
 *
 * 코사인 유사도는 벡터 크기에 영향을 받지 않아, 정규화 없이 그대로 씁니다.
 */
export type ScentWeights = Partial<Record<ScentFamilyKey, number>>

/** 매칭에 쓰는 향수 한 개. 이름 · 브랜드는 결과 화면에 쓰지 않아 담지 않습니다. */
export interface ScentVector {
  perfumeId: number
  /** 지도 좌표 (x 0~100, y 0~83.056) */
  x: number
  y: number
  /** 국내 선정 순위 1~200. 유사도가 같을 때 이 값이 작은 향수를 씁니다. */
  rank: number
  families: ScentWeights
}

/** `data/scentVectors.ts` 스냅샷의 한 줄. ⚠️ API 가 붙으면 이 타입은 사라집니다. */
export interface ScentVectorSnapshotRow {
  fragranticaId: number
  rank: number
  x: number
  y: number
  families: ScentWeights
}

/**
 * 결과 문구가 갈리는 기준.
 *
 * n = 고른 계열을 **모두** 가진 향수의 수. 조합 목록을 코드에 적어두지 않고
 * 데이터에서 세어 정합니다. 지도가 다시 만들어져도 목록과 어긋나지 않게 하려는 것입니다.
 */
export type TasteMatchMode =
  /** n ≥ 2 — 후보가 여럿이라 비율이 가장 가까운 향수가 뽑혔습니다 */
  | 'NORMAL'
  /** n = 1 — 두 향을 함께 담은 향수가 하나뿐입니다 */
  | 'RARE'
  /** n = 0 — 두 향을 함께 담은 향수가 없어 1순위 향수가 뽑혔습니다 */
  | 'NO_OVERLAP'

/** 취향 테스트 결과. 화면에는 문구만 쓰고, 향수 정보는 지도에서 보여줍니다. */
export interface TasteMatch {
  /** 고른 계열. `[0]` 이 1순위입니다. */
  picks: readonly ScentFamilyKey[]
  perfumeId: number
  x: number
  y: number
  similarity: number
  mode: TasteMatchMode
  /** 고른 계열을 모두 가진 향수의 수 */
  candidateCount: number
}
