export const ROUTES = {
  HOME: '/',

  PERFUMES: '/perfumes',
  PERFUME_DETAIL: '/perfumes/:perfumeId',
  REVIEW_DETAIL: '/reviews/:reviewId',

  BRANDS: '/brands',
  BRAND_DETAIL: '/brands/:brandId',
  NOTES: '/notes',
  NOTE_DETAIL: '/notes/:noteId',

  /*
   * NOTE: 추천(에픽 109)은 주소가 없습니다 — 메인의 모달입니다(`RecommendModal`).
   * 그래서 추천 결과는 링크로 공유할 수 없습니다. 공유가 필요해지면 메인에 `/?q=` 를
   * 내는 쪽이지, 화면을 되살리는 쪽이 아닙니다.
   */

  TASTE_TEST: '/test',

  MY_SHELF: '/shelf',
  COLLECTION_DETAIL: '/collections/:collectionId',

  COMMUNITY_REVIEWS: '/community/reviews',
  COMMUNITY_FREE: '/community/free',
  POST_DETAIL: '/community/posts/:postId',
  REVIEW_WRITE: '/community/reviews/write',
  REVIEW_EDIT: '/community/reviews/:reviewId/edit',
  POST_WRITE: '/community/free/write',
  POST_EDIT: '/community/free/:postId/edit',

  LOGIN: '/login',
  SIGNUP: '/signup',
  PASSWORD_RESET: '/password/reset',
  ACCOUNT: '/account', // A29 정보 변경 (+ A30 비밀번호 변경 · 탈퇴 모달)
} as const

export const toPerfumeDetail = (perfumeId: number | string) =>
  `/perfumes/${perfumeId}`

export const toPerfumeSearch = (keyword: string) =>
  `${ROUTES.PERFUMES}?keyword=${encodeURIComponent(keyword)}`
export const toReviewDetail = (reviewId: number | string) =>
  `/reviews/${reviewId}`
export const toBrandDetail = (brandId: number | string) => `/brands/${brandId}`
export const toNoteDetail = (noteId: number | string) => `/notes/${noteId}`
export const toCollectionDetail = (collectionId: number | string) =>
  `/collections/${collectionId}`

/**
 * 진열대의 **컬렉션 무대**로 바로 보냅니다. 컬렉션 목록은 제 주소가 없고
 * `MyShelfPage` 안의 상태라, 밖에서 초깃값을 넣는 구멍이 이 쿼리 하나입니다.
 *
 * NOTE: `COLLECTION_DETAIL`(`/collections/:id`)은 컬렉션 **한 개**의 상세라 다른
 * 화면입니다. 목록으로 보내려고 그 경로를 쓰면 안 됩니다.
 * NOTE: 값은 `MyShelfPage` 의 `SHELF_STAGE_PARAM` · `SHELF_STAGE_COLLECTION` 과 한
 * 벌입니다 — 한쪽만 고치면 진열대가 열립니다.
 *
 * @returns `/shelf?stage=collection`
 */
export const toMyShelfCollection = () => `/shelf?stage=collection`
export const toPostDetail = (postId: number | string) =>
  `/community/posts/${postId}`
export const toReviewEdit = (reviewId: number | string) =>
  `/community/reviews/${reviewId}/edit`
export const toPostEdit = (postId: number | string) =>
  `/community/free/${postId}/edit`
