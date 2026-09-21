import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/** 노트 도메인 타입 (와이어프레임 A35 · A36) */

/** 목록(A35)이 주는 모양. 상세에는 설명이 하나 더 붙습니다(`NoteDetail`) */
export interface Note {
  noteId: number
  name: string
  /** 없는 노트가 있습니다 */
  nameKo: string | null
  /**
   * 대분류. NOTE: 외래 키가 아닌 열린 문자열이라 화면에 고정 목록을 두지 않습니다.
   * 향 지도의 향 계열(9가지)과 다른 어휘입니다 — 섞어 쓰면 대분류가 통째로 사라집니다.
   */
  accordFamily: string | null
  imageUrl: string | null
  /** 향수에 많이 쓰이는 순위. 화면이 이 값으로 줄 세우지 않습니다 — 목록이 이미 그 순서입니다 */
  popularityRank: number | null
}

/** 목록에 설명이 붙은 모양. 컬럼이 NULL 을 허용해 비어 있을 수 있습니다 */
export interface NoteDetail extends Note {
  description: string | null
}

/** `features/perfume` 의 `PerfumeSummary` 와 같은 응답이지만, 도메인끼리 import 할 수 없어 한 번 더 적습니다 */
interface NotePerfume {
  perfumeId: number
  name: string
  nameKo: string | null
  brandName: string | null
  brandNameKo: string | null
  imageUrl: string | null
  scentFamily: ScentFamilyKey | null
}

export interface NotePerfumesResponse {
  perfumes: NotePerfume[]
  /** 0부터 시작합니다 */
  page: number
  size: number
  totalElements: number
}
