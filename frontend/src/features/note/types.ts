import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

/**
 * 노트 도메인 타입 (와이어프레임 A35 · A36)
 *
 * ⚠️ 노트는 기능 명세서에 요구사항 ID 가 없는 신규 화면입니다(명세서 이후 수정 예정).
 */

/**
 * 노트 한 개 — **목록(A35)이 주는 모양입니다.**
 *
 * 상세는 여기에 설명이 하나 더 붙습니다(`NoteDetail`). 백엔드도 같은 이유로 DTO 를
 * 둘로 나눠 두었습니다(`NoteSummaryResponse` · `NoteDetailResponse`) — 활성 노트
 * 246개가 한 번에 오는 목록 응답에 설명까지 실으면 크게 무거워집니다.
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
 * 노트 상세 (`GET /notes/{noteId}`). 목록의 한 줄에 **설명이 붙습니다.**
 *
 * 설명은 `notes.description` 입니다 — V21 마이그레이션에서 생겼고 시드가 246개를
 * 전부 채워 둡니다(두 문장, 53~81자). 한 줄짜리 문구가 아니므로 화면은 줄바꿈을
 * 감당하는 자리에 둡니다.
 *
 * **비어 있을 수 있습니다.** 컬럼이 NULL 을 허용하고 설명은 채워지는 대로 들어옵니다
 * (마이그레이션 주석과 같은 약속). 비면 화면이 설명 판을 그리지 않습니다 — 빈 판을
 * 두면 "아직 안 불러온 것" 처럼 보입니다.
 */
export interface NoteDetail extends Note {
  description: string | null
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
