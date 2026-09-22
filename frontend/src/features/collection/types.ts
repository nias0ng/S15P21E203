/** 공개 · 비공개 구분이 없습니다 — 남에게 보이는 길은 자유 게시판의 공유 글뿐입니다 */
export interface CollectionSummary {
  collectionId: number
  title: string
  description: string | null
  perfumeCount: number
  /** NOTE: 백엔드 목록 응답에 없어 빈 자리 세 개로 채웁니다 — 지우면 카드가 납작해집니다 */
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

export interface CollectionDetail extends CollectionSummary {
  perfumes: CollectionPerfume[]
}

export interface CollectionInput {
  title: string
  description: string | null
}
