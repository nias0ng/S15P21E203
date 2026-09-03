/**
 * 경로 문자열은 여기서만 정의합니다.
 * 화면/링크가 늘어나도 오타로 깨지는 링크가 생기지 않도록 상수로 관리합니다.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  MAP: '/map',
  PERFUME_DETAIL: '/perfumes/:perfumeId',
  RECOMMEND: '/recommend',
  COMMUNITY: '/community',
  MY_SHELF: '/my/shelf',
} as const

/** ROUTES.PERFUME_DETAIL 같은 동적 경로에 값을 채워 실제 링크를 만듭니다. */
export const toPerfumeDetail = (perfumeId: number | string) =>
  `/perfumes/${perfumeId}`
