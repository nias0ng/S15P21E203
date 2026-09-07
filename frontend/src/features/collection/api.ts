import type { CollectionDetail, CollectionSummary } from './types'

/**
 * ⚠️ 백엔드에 컬렉션 엔드포인트가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다. API 가 준비되면 이 함수들 본문만 http.get 으로 바꾸세요.
 */
export async function getMyCollections(): Promise<CollectionSummary[]> {
  return PLACEHOLDER_COLLECTIONS
}

export async function getCollectionDetail(
  collectionId: number,
): Promise<CollectionDetail> {
  const summary =
    PLACEHOLDER_COLLECTIONS.find(
      (item) => item.collectionId === collectionId,
    ) ?? PLACEHOLDER_COLLECTIONS[0]!

  return {
    ...summary,
    perfumes: [
      {
        perfumeId: 1,
        name: '조 말론 우드 세이지',
        brand: '조 말론 런던',
        thumbnailUrl: null,
      },
      {
        perfumeId: 2,
        name: '딥디크 오르페옹',
        brand: '딥디크',
        thumbnailUrl: null,
      },
      {
        perfumeId: 3,
        name: '르 라보 상탈 33',
        brand: '르 라보',
        thumbnailUrl: null,
      },
      {
        perfumeId: 4,
        name: '바이레도 블랑쉬',
        brand: '바이레도',
        thumbnailUrl: null,
      },
      { perfumeId: 5, name: '이솝 휘라', brand: '이솝', thumbnailUrl: null },
      {
        perfumeId: 6,
        name: '산타 마리아 콜로니아',
        brand: '산타 마리아 노벨라',
        thumbnailUrl: null,
      },
      {
        perfumeId: 7,
        name: '딥디크 필로시코스',
        brand: '딥디크',
        thumbnailUrl: null,
      },
      {
        perfumeId: 8,
        name: '조 말론 잉글리시 페어',
        brand: '조 말론 런던',
        thumbnailUrl: null,
      },
    ],
  }
}

/** ⚠️ 백엔드 API 가 붙으면 이 배열을 통째로 지우세요. */
const PLACEHOLDER_COLLECTIONS: CollectionSummary[] = [
  {
    collectionId: 1,
    title: '비 오는 날 뿌리는 향',
    description: '습한 공기에 어울리는 향들',
    perfumeCount: 12,
    previewThumbnails: [null, null, null],
  },
  {
    collectionId: 2,
    title: '데일리',
    description: null,
    perfumeCount: 5,
    previewThumbnails: [null, null, null],
  },
  {
    collectionId: 3,
    title: '겨울 우디',
    description: null,
    perfumeCount: 8,
    previewThumbnails: [null, null, null],
  },
]
