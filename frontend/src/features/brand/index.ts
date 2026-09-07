/**
 * 브랜드 도메인 공개 API (와이어프레임 A34)
 *
 * 이 폴더 밖에서는 `@/features/brand` 만 import 합니다.
 *
 * ⚠️ 기능 명세서에 요구사항 ID 가 없는 신규 화면이고 백엔드 API 도 아직 없습니다.
 * api.ts 가 자리표시자 데이터를 돌려주고 있으니 API 가 붙으면 그 함수만 바꾸세요.
 */
export { BrandGrid } from './components/BrandGrid'
export { brandKeys, brandListQuery } from './queries'
export {
  BRAND_SORTS,
  type Brand,
  type BrandSearchParams,
  type BrandSort,
} from './types'
