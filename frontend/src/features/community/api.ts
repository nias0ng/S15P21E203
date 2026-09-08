import type {
  BoardType,
  Comment,
  PostDetail,
  PostSummary,
  TrendingPerfume,
} from './types'

/**
 * ⚠️ 백엔드에 커뮤니티 엔드포인트가 아직 없습니다. 화면을 눈으로 확인할 수 있도록
 * 자리표시자를 돌려줍니다. API 가 준비되면 이 함수들 본문만 http.get 으로 바꾸세요.
 *
 *   const { data } = await http.get<Page<PostSummary>>('/posts', { params })
 */
export async function getPosts(board: BoardType): Promise<PostSummary[]> {
  return PLACEHOLDER_POSTS.filter((post) => post.board === board)
}

export async function getPostDetail(postId: number): Promise<PostDetail> {
  const summary = PLACEHOLDER_POSTS.find((post) => post.postId === postId)
  const base = summary ?? PLACEHOLDER_POSTS[0]!

  return {
    ...base,
    content:
      '우드 세이지 앤 씨 솔트를 몇 번 시향했는데, 비슷한 결로 조금 더 짠 느낌이 나는 향을 찾고 있습니다. 추천 부탁드립니다.',
    imageUrls: [],
    collectionTitle: null,
    relatedPerfumes: base.perfume ? [base.perfume] : [],
    mine: true,
  }
}

export async function getComments(): Promise<Comment[]> {
  return PLACEHOLDER_COMMENTS
}

export async function getTrendingPerfumes(): Promise<TrendingPerfume[]> {
  return [
    { perfumeId: 1, name: '조 말론 우드 세이지', postCount: 24 },
    { perfumeId: 3, name: '르 라보 상탈 33', postCount: 19 },
    { perfumeId: 2, name: '딥디크 오르페옹', postCount: 11 },
  ]
}

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

/** ⚠️ 백엔드 API 가 붙으면 아래 배열들을 통째로 지우세요. */
const PLACEHOLDER_POSTS: PostSummary[] = [
  {
    postId: 1,
    board: 'REVIEW',
    title: '처음 뿌렸을 때 바다 냄새가 났다',
    nickname: '유저닉네임',
    createdAt: hoursAgo(0.2),
    perfume: {
      perfumeId: 1,
      name: '조 말론 우드 세이지',
      brand: '조 말론 런던',
    },
    category: null,
    likeCount: 42,
    commentCount: 12,
    viewCount: 310,
    liked: false,
  },
  {
    postId: 2,
    board: 'REVIEW',
    title: '책방에서 맡던 냄새에 가장 가까운 향',
    nickname: '유저닉네임',
    createdAt: hoursAgo(0.6),
    perfume: { perfumeId: 2, name: '딥디크 오르페옹', brand: '딥디크' },
    category: null,
    likeCount: 28,
    commentCount: 8,
    viewCount: 204,
    liked: false,
  },
  {
    postId: 3,
    board: 'REVIEW',
    title: '상탈 33은 겨울에 다시 맡아야 한다',
    nickname: '유저닉네임',
    createdAt: hoursAgo(2),
    perfume: { perfumeId: 3, name: '르 라보 상탈 33', brand: '르 라보' },
    category: null,
    likeCount: 61,
    commentCount: 21,
    viewCount: 512,
    liked: true,
  },
  {
    postId: 4,
    board: 'FREE',
    title: '비 오는 날에만 뿌리는 다섯 개',
    nickname: '유저닉네임',
    createdAt: hoursAgo(0.13),
    perfume: null,
    category: 'COLLECTION',
    likeCount: 34,
    commentCount: 9,
    viewCount: 260,
    liked: false,
  },
  {
    postId: 5,
    board: 'FREE',
    title: '우디인데 달지 않은 쪽으로 찾고 있습니다',
    nickname: '유저닉네임',
    createdAt: hoursAgo(0.87),
    perfume: null,
    category: 'RECOMMEND',
    likeCount: 12,
    commentCount: 26,
    viewCount: 188,
    liked: false,
  },
  {
    postId: 6,
    board: 'FREE',
    title: '시향지와 피부에서 향이 갈리는 이유',
    nickname: '유저닉네임',
    createdAt: hoursAgo(3),
    perfume: null,
    category: 'CHAT',
    likeCount: 47,
    commentCount: 14,
    viewCount: 420,
    liked: false,
  },
]

const PLACEHOLDER_COMMENTS: Comment[] = [
  {
    commentId: 1,
    nickname: '유저닉네임',
    content: '씨 솔트 계열이면 바이레도 블랑쉬도 한 번 맡아보세요.',
    createdAt: hoursAgo(2),
    mine: false,
  },
  {
    commentId: 2,
    nickname: '유저닉네임',
    content: '저는 겨울에 더 잘 맞았습니다.',
    createdAt: hoursAgo(1),
    mine: true,
  },
  {
    commentId: 3,
    nickname: '유저닉네임',
    content: '시향지로만 맡으면 다르게 느껴질 수 있어요.',
    createdAt: hoursAgo(0.5),
    mine: false,
  },
]
