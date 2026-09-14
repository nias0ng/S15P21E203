/**
 * ⚠️ **개발 중 백엔드가 안 떠 있을 때만 쓰는 대체 데이터입니다.**
 *
 * 향수는 다른 도메인과 달리 백엔드에 이미 구현되어 있어(S15P21E203-128) 처음부터
 * 진짜 API 로 붙였습니다. 그래서 여기 있는 값은 **연동을 대신하는 것이 아니라**,
 * 백엔드를 띄우지 않고 시안을 눈으로 볼 때만 끼어듭니다.
 *
 * 끼어드는 조건은 `api.ts` 의 `withDevFallback` 에 있습니다 — 개발 모드이고,
 * 요청이 백엔드에 닿지도 못했을 때(연결 실패 · 502 · 503 · 504)뿐입니다.
 * 400 이나 404 같은 "백엔드가 대답한" 오류는 그대로 화면까지 올라갑니다.
 *
 * **백엔드가 뜨면 이 파일은 한 번도 실행되지 않습니다.** 지울 때는 이 파일과
 * `api.ts` 의 `withDevFallback` 을 함께 지우면 됩니다.
 *
 * 브랜드명은 `features/brand` 의 자리표시자와 같은 이름을 씁니다. 브랜드 상세에서
 * 넘어왔을 때 이름이 어긋나면 필터가 빈 목록을 돌려주는 것처럼 보입니다.
 */
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
    brandName: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'FRESH',
  },
  {
    perfumeId: 2,
    name: 'Lime Basil & Mandarin',
    nameKo: '라임 바질 앤 만다린',
    brandName: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'CITRUS',
  },
  {
    perfumeId: 3,
    name: 'Peony & Blush Suede',
    nameKo: '피오니 앤 블러쉬 스웨이드',
    brandName: '조 말론 런던',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 4,
    name: 'Philosykos',
    nameKo: '필로시코스',
    brandName: '딥디크',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 5,
    name: 'Do Son',
    nameKo: '도 손',
    brandName: '딥디크',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 6,
    name: 'Tam Dao',
    nameKo: '탐 다오',
    brandName: '딥디크',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 7,
    name: 'Santal 33',
    nameKo: '상탈 33',
    brandName: '르 라보',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 8,
    name: 'Another 13',
    nameKo: '어나더 13',
    brandName: '르 라보',
    imageUrl: null,
    scentFamily: 'ORIENTAL',
  },
  {
    perfumeId: 9,
    name: 'Gypsy Water',
    nameKo: '집시 워터',
    brandName: '바이레도',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
  {
    perfumeId: 10,
    name: 'Blanche',
    nameKo: '블랑쉬',
    brandName: '바이레도',
    imageUrl: null,
    scentFamily: 'FLORAL',
  },
  {
    perfumeId: 11,
    name: 'Jazz Club',
    nameKo: '재즈 클럽',
    brandName: '메종 마르지엘라',
    imageUrl: null,
    scentFamily: 'ORIENTAL',
  },
  {
    perfumeId: 12,
    name: 'By the Fireplace',
    nameKo: '바이 더 파이어플레이스',
    brandName: '메종 마르지엘라',
    imageUrl: null,
    scentFamily: 'ORIENTAL',
  },
  {
    perfumeId: 13,
    name: 'Colonia',
    nameKo: '콜로니아',
    brandName: '아쿠아 디 파르마',
    imageUrl: null,
    scentFamily: 'CITRUS',
  },
  {
    perfumeId: 14,
    name: 'Bleu de Chanel',
    nameKo: '블루 드 샤넬',
    brandName: '샤넬',
    imageUrl: null,
    scentFamily: 'FOUGERE',
  },
  {
    perfumeId: 15,
    name: 'Oud Wood',
    nameKo: '우드 우드',
    brandName: '톰 포드',
    imageUrl: null,
    scentFamily: 'WOODY',
  },
]

const DEFAULT_SIZE = 20

/**
 * 검색 대체값.
 *
 * keyword 와 brand 만 거릅니다. gender · shelf 는 백엔드가 전체 사용자 집계로
 * 판단하는 값이라 여기서 흉내 낼 근거가 없습니다 — 보내도 무시합니다.
 */
export function placeholderSearch(
  params: PerfumeSearchParams,
): PerfumeSearchResponse {
  const keyword = params.keyword?.trim().toLowerCase() ?? ''

  const matched = PERFUMES.filter((perfume) => {
    // 브랜드는 완전 일치입니다(실제 API 와 같습니다). 부분 일치는 keyword 몫입니다.
    if (params.brand && perfume.brandName !== params.brand) return false
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

/**
 * 상세 대체값.
 *
 * 없는 id 는 실제 백엔드와 같은 모양(404 PERFUME_NOT_FOUND)으로 던집니다.
 * 대체값이 끼어들었다고 해서 화면의 오류 처리 경로가 달라지면 안 됩니다.
 */
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
    description:
      '백엔드가 떠 있지 않아 대체 설명을 보여주고 있습니다. 실제 소개 문구는 서버에서 옵니다.',
    concentration: 'EAU DE PARFUM',
    brand: { brandId: 0, name: perfume.brandName ?? '' },
    images: [],
    prices: [],
  }
}
