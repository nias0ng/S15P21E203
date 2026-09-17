/**
 * 브랜드 도메인 공개 API (와이어프레임 A34)
 *
 * 이 폴더 밖에서는 `@/features/brand` 만 import 합니다.
 *
 * 브랜드 상세 엔드포인트가 없어 상세 화면은 목록에서 한 곳을 골라 씁니다
 * (queries.ts). 그 브랜드의 향수는 향수 검색 API 의 `brand` 필터가 돌려주므로
 * 화면(`pages/BrandDetailPage`)에서 향수 도메인을 직접 부릅니다.
 */
export { BrandGrid } from './components/BrandGrid'
export { brandDetailQuery, brandKeys, brandListQuery } from './queries'
export {
  BRAND_SORTS,
  DEFAULT_BRAND_SORT,
  type Brand,
  type BrandDetail,
  type BrandSearchParams,
  type BrandSort,
  type BrandsResponse,
} from './types'
