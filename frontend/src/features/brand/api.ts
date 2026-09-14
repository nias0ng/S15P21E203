import { ApiError } from '@/shared/api/http'

import type {
  Brand,
  BrandDetail,
  BrandPerfume,
  BrandSearchParams,
} from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

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

/**
 * 브랜드 상세.
 *
 * ⚠️ 백엔드에 브랜드 엔드포인트가 없습니다. API 가 준비되면 본문만 바꾸세요.
 *
 *   const { data } = await http.get<BrandDetail>(`/brands/${brandId}`)
 *   return data
 *
 * 없는 brandId 는 **404 ApiError** 로 던집니다. 평범한 Error 면 전역 재시도 규칙이
 * 4xx 만 즉시 실패로 처리해서, 없는 브랜드인데도 두 번 더 조회하느라 안내가 늦게
 * 뜹니다. 백엔드가 붙으면 http 가 같은 모양을 던지므로 화면 동작이 이어집니다.
 */
export async function getBrandDetail(brandId: number): Promise<BrandDetail> {
  const brand = PLACEHOLDER_BRANDS.find((item) => item.brandId === brandId)
  if (!brand) {
    throw new ApiError(404, 'BRAND_NOT_FOUND', '없는 브랜드입니다')
  }

  return {
    ...brand,
    description:
      PLACEHOLDER_DESCRIPTIONS[brandId] ?? '브랜드 소개를 준비 중입니다.',
  }
}

/**
 * 브랜드가 가진 향수 목록.
 *
 * ⚠️ 자리표시자입니다. 향수 검색 API(GET /perfumes)가 brand 파라미터를 이미
 * 지원하므로, 연동 때는 이 함수를 지우고 화면에서 향수 도메인을 직접 부르는 편이
 * 낫습니다 — 페이지네이션과 필터가 그쪽에 이미 있습니다.
 */
export async function getBrandPerfumes(
  brandId: number,
): Promise<BrandPerfume[]> {
  const names = PLACEHOLDER_PERFUMES[brandId] ?? []

  return names.map(([name, nameKo], index) => ({
    // 자리표시자끼리 id 가 겹치지 않게 브랜드 번호를 앞에 붙입니다
    perfumeId: brandId * 100 + index,
    name,
    nameKo,
    imageUrl: null,
  }))
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

/** ⚠️ 백엔드가 브랜드 소개를 내려주면 이 표를 통째로 지우세요. */
const PLACEHOLDER_DESCRIPTIONS: Record<number, string> = {
  1: '영국의 향과 맛을 담는 집. 여러 향을 겹쳐 쓰는 레이어링을 제안하며, 시트러스와 화이트 플로럴을 가볍게 다룹니다.',
  2: '파리 생제르맹의 작은 가게에서 시작한 브랜드. 향초에서 출발해 원료 하나의 인상을 그대로 살리는 향수를 만듭니다.',
  3: '주문을 받은 자리에서 향을 섞어 담는 방식으로 알려진 뉴욕 브랜드. 단일 노트를 이름으로 삼습니다.',
  4: '스톡홀름의 브랜드. 기억과 장소를 출발점으로 삼아, 군더더기 없는 구성으로 정리된 향을 냅니다.',
  5: '특정한 순간의 공기를 향으로 옮기는 레플리카 계열로 알려졌습니다. 병에 붙은 라벨이 그 장면을 적어 둡니다.',
  6: '이탈리아 파르마에서 시작한 브랜드. 지중해의 시트러스를 밝고 맑게 씁니다.',
  7: '프랑스의 하우스. 알데하이드를 앞세운 구성으로 현대 향수의 문법을 만든 자리에 있습니다.',
  8: '짙고 분명한 인상을 앞세우는 미국 브랜드. 우디와 스파이시를 강하게 밀어붙입니다.',
  9: '가벼운 가격으로 여러 향을 시도해 볼 수 있는 브랜드. 협업 라인으로 폭이 넓어졌습니다.',
  10: '피렌체의 수도원 약국에서 이어진 오래된 이름. 허브와 레진을 다루는 방식이 고전적입니다.',
}

/**
 * ⚠️ 브랜드별 향수 자리표시자. `[영문명, 한글명]` 입니다.
 *
 * 실제 목록은 향수 검색 API 의 brand 필터가 돌려줍니다. 여기 있는 것은 화면 배치를
 * 눈으로 확인하기 위한 값이라 개수도 실제 perfumeCount 와 맞지 않습니다.
 */
const PLACEHOLDER_PERFUMES: Record<number, [string, string | null][]> = {
  1: [
    ['Wood Sage & Sea Salt', '우드 세이지 앤 씨 솔트'],
    ['Lime Basil & Mandarin', '라임 바질 앤 만다린'],
    ['Peony & Blush Suede', '피오니 앤 블러쉬 스웨이드'],
    ['English Pear & Freesia', '잉글리시 페어 앤 프리지아'],
    ['Blackberry & Bay', '블랙베리 앤 베이'],
  ],
  2: [
    ['Philosykos', '필로시코스'],
    ['Do Son', '도 손'],
    ['Tam Dao', '탐 다오'],
    ['Eau Rose', '오 로즈'],
  ],
  3: [
    ['Santal 33', '상탈 33'],
    ['Another 13', '어나더 13'],
    ['Rose 31', '로즈 31'],
    ['Bergamote 22', '베르가못 22'],
  ],
  4: [
    ['Gypsy Water', '집시 워터'],
    ['Blanche', '블랑쉬'],
    ['Mojave Ghost', '모하비 고스트'],
  ],
  5: [
    ['Jazz Club', '재즈 클럽'],
    ['By the Fireplace', '바이 더 파이어플레이스'],
    ['Lazy Sunday Morning', '레이지 선데이 모닝'],
    ['Beach Walk', '비치 워크'],
  ],
  6: [
    ['Colonia', '콜로니아'],
    ['Arancia di Capri', '아란치아 디 카프리'],
    ['Fico di Amalfi', '피코 디 아말피'],
  ],
  7: [
    ['N°5', '넘버 5'],
    ['Coco Mademoiselle', '코코 마드모아젤'],
    ['Bleu de Chanel', '블루 드 샤넬'],
  ],
  8: [
    ['Oud Wood', '우드 우드'],
    ['Tobacco Vanille', '토바코 바닐라'],
    ['Lost Cherry', '로스트 체리'],
  ],
  9: [
    ['Red Vanilla', '레드 바닐라'],
    ['Gardenia', '가드니아'],
  ],
  10: [
    ['Acqua di Colonia', '아쿠아 디 콜로니아'],
    ['Melograno', '멜로그라노'],
  ],
}
