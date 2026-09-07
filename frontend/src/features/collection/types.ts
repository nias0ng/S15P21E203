/**
 * 컬렉션 도메인 타입 (와이어프레임 A13 하단 · A17 · A19 — COL-01 ~ COL-08)
 *
 * 와이어프레임 주석: "컬렉션은 공개 · 비공개 구분이 없다 — 컬렉션을 남에게 보이는
 * 길은 자유 게시판의 컬렉션 공유 글뿐이다". 그래서 공개 여부 필드가 없습니다.
 */
export interface CollectionSummary {
  collectionId: number
  title: string
  description: string | null
  perfumeCount: number
  /** 카드에 미리보기로 보여줄 향수 썸네일 (와이어프레임은 3장) */
  previewThumbnails: (string | null)[]
}

export interface CollectionPerfume {
  perfumeId: number
  name: string
  brand: string
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
