import type { ShelfItem } from './types'

/**
 * ⚠️ 백엔드에 진열대 엔드포인트가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다. API 가 준비되면 이 함수 본문만 http.get 으로 바꾸세요.
 *
 *   const { data } = await http.get<ShelfItem[]>('/me/shelf')
 */
export async function getShelfItems(): Promise<ShelfItem[]> {
  return PLACEHOLDER_SHELF
}

/** ⚠️ 백엔드 API 가 붙으면 이 배열을 통째로 지우세요. */
const PLACEHOLDER_SHELF: ShelfItem[] = [
  {
    shelfItemId: 1,
    perfumeId: 1,
    name: '조 말론 우드 세이지',
    brand: '조 말론 런던',
    thumbnailUrl: null,
    category: 'OWNED',
    representative: true,
    rating: 4,
    memo: '처음 뿌렸을 때 바다 냄새가 났다.',
    memoUpdatedAt: '2026-08-20T00:00:00Z',
  },
  {
    shelfItemId: 2,
    perfumeId: 2,
    name: '딥디크 오르페옹',
    brand: '딥디크',
    thumbnailUrl: null,
    category: 'OWNED',
    representative: false,
    rating: 5,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 3,
    perfumeId: 3,
    name: '르 라보 상탈 33',
    brand: '르 라보',
    thumbnailUrl: null,
    category: 'OWNED',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 4,
    perfumeId: 4,
    name: '바이레도 블랑쉬',
    brand: '바이레도',
    thumbnailUrl: null,
    category: 'OWNED',
    representative: false,
    rating: 3,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 5,
    perfumeId: 5,
    name: '이솝 휘라',
    brand: '이솝',
    thumbnailUrl: null,
    category: 'TRIED',
    representative: false,
    rating: 4,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 6,
    perfumeId: 6,
    name: '산타 마리아 콜로니아',
    brand: '산타 마리아 노벨라',
    thumbnailUrl: null,
    category: 'TRIED',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 7,
    perfumeId: 7,
    name: '딥디크 필로시코스',
    brand: '딥디크',
    thumbnailUrl: null,
    category: 'TRIED',
    representative: false,
    rating: 2,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 8,
    perfumeId: 8,
    name: '조 말론 잉글리시 페어',
    brand: '조 말론 런던',
    thumbnailUrl: null,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
  {
    shelfItemId: 9,
    perfumeId: 9,
    name: '르 라보 어나더 13',
    brand: '르 라보',
    thumbnailUrl: null,
    category: 'WISH',
    representative: false,
    rating: null,
    memo: null,
    memoUpdatedAt: null,
  },
]
