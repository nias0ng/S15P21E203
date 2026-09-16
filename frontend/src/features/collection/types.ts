/**
 * 컬렉션 도메인 타입 (와이어프레임 A13 하단 · A17 · A19 — COL-01 ~ COL-08)
 *
 * 와이어프레임 주석: "컬렉션은 공개 · 비공개 구분이 없다 — 컬렉션을 남에게 보이는
 * 길은 자유 게시판의 컬렉션 공유 글뿐이다". 그래서 공개 여부 필드가 없습니다.
 *
 * ⚠️ 화면은 `title`, 백엔드는 `name` 이라고 부릅니다. 옮기는 곳은 api.ts 한 군데입니다.
 */
export interface CollectionSummary {
  collectionId: number
  title: string
  description: string | null
  perfumeCount: number
  /**
   * 카드에 미리보기로 보여줄 향수 썸네일. 늘 3칸이고 빈 칸은 null 입니다
   * (와이어프레임은 3장 — 향수가 모자라도 칸 수가 같아야 카드 높이가 맞습니다).
   */
  previewThumbnails: (string | null)[]
}

export interface CollectionPerfume {
  /** 이 컬렉션에 담긴 진열대 항목. 빼기 요청이 이 번호를 씁니다 */
  shelfItemId: number
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl: string | null
}

export interface CollectionDetail extends CollectionSummary {
  perfumes: CollectionPerfume[]
}

/** A19 컬렉션 수정에서 제출하는 값 (제목 · 설명만) */
export interface CollectionInput {
  title: string
  description: string | null
}

/**
 * A19 컬렉션 만들기에서 제출하는 값.
 *
 * ⚠️ **향수를 하나 이상 골라야 합니다.** 와이어프레임 주석은 "향수 없이도 생성 가능" 이지만
 * 백엔드가 `shelfItemIds` 를 최소 1개로 받고, 마지막 향수도 뺄 수 없게 막습니다.
 */
export interface CollectionCreateInput extends CollectionInput {
  shelfItemIds: number[]
}

/**
 * 컬렉션에 넣을 수 있는 향수 — 진열대에 있는 향수뿐입니다 (A19 주석).
 * 진열대 도메인을 import 할 수 없어 화면(pages)이 진열대 데이터를 이 모양으로 옮겨 넘깁니다.
 */
export interface CollectionCandidate {
  shelfItemId: number
  name: string
  brand: string | null
  thumbnailUrl: string | null
}
