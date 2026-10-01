import { ROUTES } from '@/shared/config/routes'

/** 주요 메뉴. 넓은 화면의 가운데 메뉴(`PrimaryNav`)와 좁은 화면의 접은 메뉴(`MobileMenu`)가 같이 씁니다 */
export const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: 'PERFUME' },
  { to: ROUTES.BRANDS, label: 'BRAND' },
  { to: ROUTES.NOTES, label: 'NOTE' },
  { to: ROUTES.MY_SHELF, label: 'SHELF', requiresAuth: true },
]

/**
 * 커뮤니티 갈래. `CommunityMenu` 와 `MobileMenu` 가 같이 씁니다.
 * 이름은 키로 두고 그릴 때 풉니다 — 모듈이 읽힐 때 풀면 언어를 바꿔도 그대로입니다
 */
export const COMMUNITY_ITEMS = [
  { to: ROUTES.COMMUNITY_REVIEWS, labelKey: 'header.community.reviews' },
  { to: ROUTES.COMMUNITY_FREE, labelKey: 'header.community.free' },
] as const
