import type { Brand, BrandSearchParams } from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다. http 인스턴스의 baseURL 이 이미 그것입니다.

/**
 * A34 브랜드 목록.
 *
 * ⚠️ 백엔드에 브랜드 엔드포인트가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다. API 가 준비되면 이 함수 본문만 http.get 으로 바꾸면 됩니다.
 *
 *   const { data } = await http.get<Brand[]>('/brands', { params })
 *   return data
 */
export async function getBrands(params: BrandSearchParams): Promise<Brand[]> {
  const keyword = params.keyword?.trim().toLowerCase() ?? ''

  const filtered = PLACEHOLDER_BRANDS.filter(
    (brand) =>
      !keyword ||
      brand.name.toLowerCase().includes(keyword) ||
      brand.romanizedName.toLowerCase().includes(keyword),
  )

  // 기본 정렬은 abc 순입니다. 한글 브랜드는 로마자 표기 기준으로 끼워 넣습니다.
  return [...filtered].sort((a, b) =>
    params.sort === 'PERFUME_COUNT'
      ? b.perfumeCount - a.perfumeCount
      : a.romanizedName.localeCompare(b.romanizedName),
  )
}

/** ⚠️ 백엔드 API 가 붙으면 이 배열을 통째로 지우세요. */
const PLACEHOLDER_BRANDS: Brand[] = [
  {
    brandId: 1,
    name: '조 말론 런던',
    romanizedName: 'Jo Malone London',
    logoUrl: null,
    perfumeCount: 42,
  },
  {
    brandId: 2,
    name: '딥디크',
    romanizedName: 'Diptyque',
    logoUrl: null,
    perfumeCount: 31,
  },
  {
    brandId: 3,
    name: '르 라보',
    romanizedName: 'Le Labo',
    logoUrl: null,
    perfumeCount: 24,
  },
  {
    brandId: 4,
    name: '바이레도',
    romanizedName: 'Byredo',
    logoUrl: null,
    perfumeCount: 18,
  },
  {
    brandId: 5,
    name: '메종 마르지엘라',
    romanizedName: 'Maison Margiela',
    logoUrl: null,
    perfumeCount: 16,
  },
  {
    brandId: 6,
    name: '아쿠아 디 파르마',
    romanizedName: 'Acqua di Parma',
    logoUrl: null,
    perfumeCount: 15,
  },
  {
    brandId: 7,
    name: '샤넬',
    romanizedName: 'Chanel',
    logoUrl: null,
    perfumeCount: 12,
  },
  {
    brandId: 8,
    name: '톰 포드',
    romanizedName: 'Tom Ford',
    logoUrl: null,
    perfumeCount: 11,
  },
  {
    brandId: 9,
    name: '자라',
    romanizedName: 'Zara',
    logoUrl: null,
    perfumeCount: 9,
  },
  {
    brandId: 10,
    name: '산타 마리아 노벨라',
    romanizedName: 'Santa Maria Novella',
    logoUrl: null,
    perfumeCount: 7,
  },
]
