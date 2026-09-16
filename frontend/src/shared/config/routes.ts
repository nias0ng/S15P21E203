/**
 * 경로 문자열은 여기서만 정의합니다.
 * 화면/링크가 늘어나도 오타로 깨지는 링크가 생기지 않도록 상수로 관리합니다.
 *
 * 오른쪽 주석은 와이어프레임 화면 번호입니다 (피그마 "1920w light" 아트보드).
 */
export const ROUTES = {
  /** A01 랜딩 · 향 지도 — 개인화 추천도 이 화면의 취향 영역으로 표시됩니다 */
  HOME: '/',

  // 향수 (에픽 110)
  PERFUMES: '/perfumes', // A33 향수 목록 + 필터
  PERFUME_SEARCH: '/perfumes/search', // A09 향수 검색 결과
  PERFUME_DETAIL: '/perfumes/:perfumeId', // A10 향수 상세
  REVIEW_DETAIL: '/reviews/:reviewId', // A12 후기 상세

  // 브랜드 (에픽 111) · 노트 (에픽 112)
  BRANDS: '/brands', // A34 브랜드 페이지
  BRAND_DETAIL: '/brands/:brandId', // 브랜드 상세 (와이어프레임에 없는 신규 화면)
  NOTES: '/notes', // A35 노트 목록
  NOTE_DETAIL: '/notes/:noteId', // A36 노트 상세

  // 추천 (에픽 109)
  RECOMMEND: '/recommend', // A06 자연어 추천 결과 (지도 배경 + 결과 카드 + 미니맵)

  // 취향 테스트 (요구사항 TST-03)
  // 원래 자리는 회원가입 직후 온보딩 스텝입니다. 백엔드가 붙기 전까지 화면을 바로
  // 열어볼 수 있도록 둔 임시 경로라, 가입이 동작하면 이 상수와 라우트를 지웁니다.
  TASTE_TEST: '/test',

  // 진열대 · 컬렉션 (에픽 113)
  MY_SHELF: '/shelf', // A13 진열대 + 컬렉션 한 화면
  COLLECTION_DETAIL: '/collections/:collectionId', // A17 컬렉션 상세

  // 커뮤니티 (에픽 114)
  COMMUNITY_REVIEWS: '/community/reviews', // A22a 후기 게시판
  COMMUNITY_FREE: '/community/free', // A22b 자유 게시판
  POST_DETAIL: '/community/posts/:postId', // A23 게시글 상세 + 댓글
  REVIEW_WRITE: '/community/reviews/write', // A24a 후기 작성
  /**
   * A24a 후기 수정. 작성과 **같은 화면**(`ReviewWritePage`)을 쓰고 주소만 다릅니다.
   *
   * 주소를 나눈 이유: 부르는 API 가 다르고(`POST` · `PATCH`), 수정은 본인만
   * 할 수 있어 나중에 보호 라우트를 붙일 자리가 필요합니다.
   */
  REVIEW_EDIT: '/community/reviews/:reviewId/edit',
  POST_WRITE: '/community/free/write', // A24b 자유 글 작성 · 수정

  // 계정 (에픽 115) — 마이페이지는 없고 헤더 닉네임 ▾ 에서 바로 들어갑니다
  LOGIN: '/login', // A28 로그인
  SIGNUP: '/signup', // A28 회원가입 (+ A32 동의 블록)
  PASSWORD_RESET: '/password/reset', // A31 비밀번호 찾기 · 재설정
  ACCOUNT: '/account', // A29 정보 변경 (+ A30 비밀번호 변경 · 탈퇴 모달)
} as const

/** ROUTES.PERFUME_DETAIL 같은 동적 경로에 값을 채워 실제 링크를 만듭니다. */
export const toPerfumeDetail = (perfumeId: number | string) =>
  `/perfumes/${perfumeId}`
export const toReviewDetail = (reviewId: number | string) =>
  `/reviews/${reviewId}`
export const toBrandDetail = (brandId: number | string) => `/brands/${brandId}`
export const toNoteDetail = (noteId: number | string) => `/notes/${noteId}`
export const toCollectionDetail = (collectionId: number | string) =>
  `/collections/${collectionId}`
export const toPostDetail = (postId: number | string) =>
  `/community/posts/${postId}`
export const toReviewEdit = (reviewId: number | string) =>
  `/community/reviews/${reviewId}/edit`
