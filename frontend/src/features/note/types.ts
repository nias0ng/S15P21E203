import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 노트 도메인 타입 (와이어프레임 A35 · A36)
 *
 * ⚠️ 노트는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 */

/**
 * 노트 한 개. **목록과 상세가 같은 모양입니다** — 상세에만 있는 값이 없습니다.
 *
 * 설명(description)은 백엔드 표에 아예 없습니다. 와이어프레임 A36 의 "설명" 칸은
 * 그래서 비어 있고, 컬럼이 생기기 전까지 화면에 그 상자를 두지 않습니다.
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
   * ⚠️ **열린 문자열입니다.** 백엔드가 원본 파일의 코드를 그대로 내보내므로
   * (`notes.accord_family`, 외래 키로 묶여 있지 않습니다) 화면에 고정 목록을 두지
   * 않습니다. 비어 있는 노트도 있습니다.
   *
   * ⚠️ **향 지도의 향 계열(`shared/config/scentFamilies`, 9가지)과 다른 어휘입니다.**
   * 이쪽은 13가지이고 `MUSK` · `AROMATIC` · `SMOKY` 처럼 저쪽에 없는 값이 옵니다.
   * 섞어 쓰면 대분류가 통째로 사라집니다.
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
 * 노트별 향수 한 건.
 *
 * `features/perfume` 의 `PerfumeSummary` 와 **같은 응답**입니다(백엔드가 향수 검색과
 * 같은 DTO 를 씁니다). 그런데 `features/a` 는 `features/b` 를 import 할 수 없어
 * (ESLint 레이어 규칙) 여기 한 번 더 적습니다.
 *
 * 베껴 적은 타입이 낡는 것이 걱정되지만, 화면이 이 값을 그대로 `PerfumeGrid` 에
 * 넘기므로 **한쪽이 바뀌면 타입 에러로 바로 드러납니다.** 조용히 어긋나지 않습니다.
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
