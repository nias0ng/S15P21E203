/** 개발 중 백엔드가 안 떠 있을 때만 쓰는 대체 데이터입니다 — `withDevFallback` 과 함께 지우세요 */
import { ApiError } from '@/shared/api/http'

import type {
  PerfumeDetail,
  PerfumeSearchParams,
  PerfumeSearchResponse,
  PerfumeSummary,
} from './types'

const PERFUMES: PerfumeSummary[] = [
  {
    perfumeId: 1,
    name: 'Wood Sage & Sea Salt',
    nameKo: '우드 세이지 앤 씨 솔트',
    brandName: 'Jo Malone London',
    brandNameKo: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'AQUATIC',
  },
  {
    perfumeId: 2,
    name: 'Lime Basil & Mandarin',
    nameKo: '라임 바질 앤 만다린',
    brandName: 'Jo Malone London',
    brandNameKo: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'CITRUS',
  },
  {
    perfumeId: 3,
    name: 'Peony & Blush Suede',
    nameKo: '피오니 앤 블러쉬 스웨이드',
    brandName: 'Jo Malone London',
    brandNameKo: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 4,
    name: 'Philosykos',
    nameKo: '필로시코스',
    brandName: 'Diptyque',
    brandNameKo: '딥디크',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 5,
    name: 'Do Son',
    nameKo: '도 손',
    brandName: 'Diptyque',
    brandNameKo: '딥디크',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 6,
    name: 'Tam Dao',
    nameKo: '탐 다오',
    brandName: 'Diptyque',
    brandNameKo: '딥디크',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 7,
    name: 'Santal 33',
    nameKo: '상탈 33',
    brandName: 'Le Labo',
    brandNameKo: '르 라보',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 8,
    name: 'Another 13',
    nameKo: '어나더 13',
    brandName: 'Le Labo',
    brandNameKo: '르 라보',
    imageUrl: null,
    scentFamily: 'MUSK',
  },
  {
    perfumeId: 9,
    name: 'Gypsy Water',
    nameKo: '집시 워터',
    brandName: 'Byredo',
    brandNameKo: '바이레도',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 10,
    name: 'Blanche',
    nameKo: '블랑쉬',
    brandName: 'Byredo',
    brandNameKo: '바이레도',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 11,
    name: 'Jazz Club',
    nameKo: '재즈 클럽',
    brandName: 'Maison Margiela',
    brandNameKo: '메종 마르지엘라',
    imageUrl: null,
    scentFamily: 'AMBER',
  },
  {
    perfumeId: 12,
    name: 'By the Fireplace',
    nameKo: '바이 더 파이어플레이스',
    brandName: 'Maison Margiela',
    brandNameKo: '메종 마르지엘라',
    imageUrl: null,
    scentFamily: 'GOURMAND',
  },
  {
    perfumeId: 13,
    name: 'Colonia',
    nameKo: '콜로니아',
    brandName: 'Acqua di Parma',
    brandNameKo: '아쿠아 디 파르마',
    imageUrl: null,
    scentFamily: 'CITRUS',
  },
  {
    perfumeId: 14,
    name: 'Bleu de Chanel',
    nameKo: '블루 드 샤넬',
    brandName: 'Chanel',
    brandNameKo: '샤넬',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    /* 이 한 건만 한국어 이름이 없습니다 — 전부 채워 두면 카드가 원어명만으로 서는 길을 개발 화면에서 한 번도 밟지 않습니다 */
    perfumeId: 15,
    name: 'Oud Wood',
    nameKo: null,
    brandName: 'Tom Ford',
    brandNameKo: null,
    imageUrl: null,
    scentFamily: 'WOODY',
  },
]

const DEFAULT_SIZE = 20

/**
 * 검색 대체값. gender · ranking 은 집계값이라 흉내 낼 근거가 없고, brandId 는 대체값에
 * 브랜드 번호가 없어 무시합니다
 */
export function placeholderSearch(
  params: PerfumeSearchParams,
): PerfumeSearchResponse {
  const keyword = params.keyword?.trim().toLowerCase() ?? ''

  const matched = PERFUMES.filter((perfume) => {
    if (!keyword) return true
    return (
      perfume.name.toLowerCase().includes(keyword) ||
      (perfume.nameKo?.includes(keyword) ?? false) ||
      (perfume.brandName?.toLowerCase().includes(keyword) ?? false)
    )
  })

  const page = params.page ?? 0
  const size = params.size ?? DEFAULT_SIZE
  const start = page * size

  return {
    perfumes: matched.slice(start, start + size),
    page,
    size,
    totalElements: matched.length,
  }
}

/** 상세 대체값. 없는 id 는 실제 백엔드와 같은 404 PERFUME_NOT_FOUND 로 던집니다 */
export function placeholderDetail(perfumeId: number): PerfumeDetail {
  const perfume = PERFUMES.find((item) => item.perfumeId === perfumeId)
  if (!perfume) {
    throw new ApiError(404, 'PERFUME_NOT_FOUND', '없는 향수입니다')
  }

  return {
    perfumeId: perfume.perfumeId,
    name: perfume.name,
    nameKo: perfume.nameKo,
    gender: 'UNISEX',
    concentration: 'EAU DE PARFUM',
    brand: { brandId: 0, name: perfume.brandName ?? '' },
    images: [],
    prices: [],
    myReviewId: null,
    productionStatus: null,
  }
}
