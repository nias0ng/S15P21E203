import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 취향 테스트 도메인 타입 (TST-03). 향 계열을 1~2개 고르면 향 지도의 출발점이 될
 * 향수 하나를 정합니다. 판단은 2D 좌표가 아니라 **9차원 계열 벡터**에서 합니다 —
 * UMAP 투영 좌표를 평균 내면 고르지 않은 계열 영역에 결과가 찍힙니다.
 */

/**
 * 향 계열 9개는 향 지도 · 향수 검색도 쓰는 어휘라 `shared/config` 에 한 벌만 둡니다.
 * 배열 순서가 곧 선택 화면의 타일 순서입니다(가벼운 향 → 무거운 향).
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
 * 계열별 비중. 9개 중 1~3개만 값을 갖는 희소 벡터이고 **합이 1이 아닙니다**
 * (0.2~1.0) — `1 - 합` 을 "기타 계열" 로 읽으면 안 됩니다. 코사인 유사도는 벡터
 * 크기를 타지 않아 정규화 없이 그대로 씁니다.
 */
export type ScentWeights = Partial<Record<ScentFamilyKey, number>>

/** 매칭에 쓰는 향수 한 개. 이름 · 브랜드는 결과 화면에 쓰지 않아 담지 않습니다. */
export interface ScentVector {
  perfumeId: number
  /**
   * 지도 좌표 (x 0~100, y 0~83.056). **응답은 0~1 인데 `api.ts` 가 100배 합니다** —
   * 지도 컴포넌트의 viewBox 가 100x100 이라 같은 스케일이어야 합니다.
   */
  x: number
  y: number
  /** 국내 선정 순위 1~200. 유사도가 같을 때 이 값이 작은 향수를 씁니다. */
  rank: number
  families: ScentWeights
}

/**
 * `GET /map/scent-vectors` 응답 그대로. 배열이 아니라 `perfumes` 를 감싼 객체이고,
 * `families` 의 키는 `scent_regions.code` 라 **열린 문자열**입니다 — 받는 자리에서
 * 아는 계열만 남깁니다(`api.ts`).
 */
export interface ScentVectorsResponse {
  perfumes: {
    perfumeId: number
    /** 0~1 */
    x: number
    /** 0~0.83056 */
    y: number
    rank: number
    families: Record<string, number>
  }[]
}

/**
 * 결과 문구가 갈리는 기준. n = 고른 계열을 **모두** 가진 향수의 수이고, 조합 목록을
 * 코드에 적지 않고 데이터에서 셉니다 — 지도가 다시 만들어져도 안 어긋납니다.
 */
export type TasteMatchMode =
  /** n ≥ 2 — 후보가 여럿이라 비율이 가장 가까운 향수가 뽑혔습니다 */
  | 'NORMAL'
  /** n = 1 — 두 향을 함께 담은 향수가 하나뿐입니다 */
  | 'RARE'
  /** n = 0 — 두 향을 함께 담은 향수가 없어 1순위 향수가 뽑혔습니다 */
  | 'NO_OVERLAP'

/**
 * 서버에 남은 취향 테스트 기록 (`GET · POST /users/me/taste-test`).
 *
 * **아직 치르지 않은 사람도 200 입니다** — `completed` 가 `false` 이고 나머지가 비어
 * 옵니다. `picks` 는 `scent_regions.code` 를 그대로 돌려주는 열린 값이라
 * `ScentFamilyKey[]` 로 좁히지 않습니다.
 */
export interface TasteTestRecord {
  completed: boolean
  /** 고른 계열. `[0]` 이 1순위입니다. 안 치렀으면 빈 배열 */
  picks: string[]
  /**
   * 결과 향수. **`completed` 가 true 여도 null 일 수 있습니다** — 지도를 다시
   * 만들면서 그 향수가 빠진 경우입니다.
   */
  matchedPerfumeId: number | null
  /** 결과 향수의 지도 좌표. 0~1 스케일입니다(화면은 100배 해서 씁니다) */
  x: number | null
  y: number | null
  completedAt: string | null
}

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
