/**
 * 컬렉션 도메인 타입 (와이어프레임 A13 하단 · A17 · A19 — COL-01 ~ COL-08)
 *
 * 와이어프레임 주석: "컬렉션은 공개 · 비공개 구분이 없다 — 컬렉션을 남에게 보이는
 * 길은 자유 게시판의 컬렉션 공유 글뿐이다". 그래서 공개 여부 필드가 없습니다.
 */
export interface CollectionSummary {
  collectionId: number
  /**
   * 컬렉션 이름.
   *
   * ⚠️ **서버는 `name` 입니다.** 이름이 어긋나는 자리가 여기 하나라, 옮기는 일도
   * `api.ts` 의 `toCollectionSummary` 한 곳에서만 합니다.
   */
  title: string
  description: string | null
  perfumeCount: number
  /**
   * 카드에 미리보기로 보여줄 향수 썸네일 (와이어프레임은 3장).
   *
   * ⚠️ **백엔드 목록 응답에 없습니다.** `CollectionSummaryResponse` 는
   * `collectionId · name · description · perfumeCount · createdAt · updatedAt` 뿐입니다.
   * 지금은 빈 자리 세 개(`[null, null, null]`)로 채워 카드 높이를 지킵니다 — 지우면
   * 카드가 납작해져 옆의 [+ 컬렉션 만들기] 점선 카드와 높이가 어긋납니다.
   * BE 가 내려주기 시작하면 그 변환 한 줄만 고칩니다.
   */
  previewThumbnails: (string | null)[]
}

export interface CollectionPerfume {
  /**
   * **컬렉션에서 향수를 가리키는 번호는 `shelfItemId` 입니다.**
   *
   * 컬렉션에는 진열대에 담은 향수만 넣을 수 있어, 담고 빼는 요청이 전부 이 번호를
   * 씁니다(`POST .../perfumes` 는 본문에, `DELETE .../perfumes/{shelfItemId}` 는 경로에).
   * `perfumeId` 로 지우려 하면 남의 항목을 지우거나 404 가 납니다.
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
