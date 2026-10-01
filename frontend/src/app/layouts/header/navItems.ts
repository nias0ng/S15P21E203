import { ROUTES } from '@/shared/config/routes'

/** 주요 메뉴. 넓은 화면의 가운데 메뉴(`PrimaryNav`)와 좁은 화면의 접은 메뉴(`MobileMenu`)가 같이 씁니다 */
export const NAV_ITEMS = [
  { to: ROUTES.PERFUMES, label: 'PERFUME' },
  { to: ROUTES.BRANDS, label: 'BRAND' },
  { to: ROUTES.NOTES, label: 'NOTE' },
  { to: ROUTES.MY_SHELF, label: 'SHELF', requiresAuth: true },
]

/** 커뮤니티 갈래. `CommunityMenu` 와 `MobileMenu` 가 같이 씁니다 */
export const COMMUNITY_ITEMS = [
  { to: ROUTES.COMMUNITY_REVIEWS, label: '후기' },
  { to: ROUTES.COMMUNITY_FREE, label: '자유' },
]
