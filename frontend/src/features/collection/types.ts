/** 공개 · 비공개 구분이 없습니다 — 남에게 보이는 길은 자유 게시판의 공유 글뿐입니다 */
export interface CollectionSummary {
  collectionId: number
  title: string
  description: string | null
  perfumeCount: number
  /**
   * 진열함에 세울 병 사진. 담긴 순서대로 **최대 3장**이고, 사진이 없는 향수는 자리를 지키려고
   * null 입니다. 빈 컬렉션은 빈 배열입니다.
   */
  previewThumbnails: (string | null)[]
}

export interface CollectionPerfume {
  /** 담고 빼는 요청이 전부 이 번호를 씁니다 — `perfumeId` 로 지우면 404 이거나 남의 항목입니다 */
  shelfItemId: number
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl: string | null
}

/** 미리보기 사진은 목록의 진열함만 씁니다 — 상세는 담긴 향수를 다 세웁니다 */
export interface CollectionDetail extends Omit<
  CollectionSummary,
  'previewThumbnails'
> {
  perfumes: CollectionPerfume[]
}

export interface CollectionInput {
  title: string
  description: string | null
}
