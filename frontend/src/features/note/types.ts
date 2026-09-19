import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 노트 도메인 타입 (와이어프레임 A35 · A36)
 *
 * ⚠️ 노트는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 */

/**
 * 노트 한 개 — **목록(A35)이 주는 모양입니다.** 상세에는 설명이 하나 더 붙습니다
 * (`NoteDetail`) — 활성 노트 246개가 한 번에 오는 목록에 설명까지 실으면 무겁습니다.
 */
export interface Note {
  noteId: number
  /** 영문 이름. 카드가 크게 적는 값입니다 */
  name: string
  /** 한국어 이름. 없는 노트가 있습니다 */
  nameKo: string | null
  /**
   * 대분류. 목록을 묶는 기준입니다.
   *
   * ⚠️ **열린 문자열입니다**(`notes.accord_family`, 외래 키가 아닙니다) — 화면에
   * 고정 목록을 두지 않습니다. 비어 있는 노트도 있습니다.
   * ⚠️ **향 지도의 향 계열(9가지)과 다른 어휘입니다** — 이쪽은 13가지이고 `MUSK` ·
   * `AROMATIC` · `SMOKY` 가 옵니다. 섞어 쓰면 대분류가 통째로 사라집니다.
   */
  accordFamily: string | null
  /** 노트 이미지. 없으면 자리표시자 상자를 그립니다 */
  imageUrl: string | null
  /**
   * 향수에 많이 쓰이는 순위(1위가 머스크). 비어 있을 수 있습니다.
   *
   * 화면이 이 값으로 줄을 세우지 않습니다 — 목록이 이미 그 순서로 옵니다.
   */
  popularityRank: number | null
}

/**
 * 노트 상세 (`GET /notes/{noteId}`). 목록의 한 줄에 **설명이 붙습니다** —
 * `notes.description`(V21 마이그레이션, 두 문장 53~81자)이라 줄바꿈을 감당하는
 * 자리에 둡니다. **컬럼이 NULL 을 허용해 비어 있을 수 있고**, 비면 화면이 설명 판을
 * 그리지 않습니다.
 */
export interface NoteDetail extends Note {
  description: string | null
}

/**
 * 노트별 향수 한 건. `features/perfume` 의 `PerfumeSummary` 와 **같은 응답**이지만
 * `features/a` 는 `features/b` 를 import 할 수 없어 여기 한 번 더 적습니다.
 * 화면이 그대로 `PerfumeGrid` 에 넘겨, 한쪽이 바뀌면 타입 에러로 드러납니다.
 */
export interface NotePerfume {
  perfumeId: number
  name: string
  nameKo: string | null
  brandName: string | null
  brandNameKo: string | null
  imageUrl: string | null
  scentFamily: ScentFamilyKey | null
}

/** `GET /notes/{noteId}/perfumes` 응답. 향수 검색과 같은 쪽 나눔입니다 */
export interface NotePerfumesResponse {
  perfumes: NotePerfume[]
  /** 현재 페이지. 0부터 시작합니다 */
  page: number
  size: number
  totalElements: number
}
