/**
 * 컬렉션 도메인 타입 (A13 하단 · A17 · A19 — COL-01 ~ COL-08). 공개 · 비공개 구분이
 * 없습니다 — 남에게 보이는 길은 자유 게시판의 컬렉션 공유 글뿐입니다.
 */
export interface CollectionSummary {
  collectionId: number
  /** ⚠️ **서버는 `name` 입니다** — 옮기는 일은 `toCollectionSummary` 한 곳입니다 */
  title: string
  description: string | null
  perfumeCount: number
  /**
   * 카드 미리보기 썸네일 3장. ⚠️ **백엔드 목록 응답에 없어** 빈 자리 세 개로 채워
   * 카드 높이를 지킵니다 — 지우면 카드가 납작해집니다. BE 가 내려주면 변환 한 줄만
   * 고칩니다.
   */
  previewThumbnails: (string | null)[]
}

export interface CollectionPerfume {
  /**
   * **컬렉션에서 향수를 가리키는 번호는 `shelfItemId` 입니다.** 담고 빼는 요청이
   * 전부 이 번호를 써서, `perfumeId` 로 지우면 남의 항목을 지우거나 404 입니다.
   */
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

/** A19 컬렉션 만들기 · 수정에서 제출하는 값 (제목 · 설명만) */
export interface CollectionInput {
  title: string
  description: string | null
}
