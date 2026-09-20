import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BoardHeader,
  communityKeys,
  FREE_SORTS,
  likePost,
  POST_CATEGORIES,
  PostList,
  postListQuery,
  postToBoardItem,
  TrendingPerfumes,
  trendingPerfumesQuery,
  unlikePost,
  type PostCategory,
  type PostSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import { cn } from '@/shared/lib/cn'
import { readPage, withQueryParams, writePage } from '@/shared/lib/queryParams'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { PillFilter } from '@/shared/ui/PillFilter'

type CategoryFilter = PostCategory | 'ALL'

/** 백엔드 기본값과 같습니다 */
const PAGE_SIZE = 20

/**
 * 자유 게시판 (A22b — CMT-01). 컬렉션 공유 글은 컬렉션을 남에게 보이는 유일한 길입니다.
 *
 * **분류 · 정렬 · 쪽을 전부 서버가 처리합니다.** 화면에서 걸렀을 때는 그 페이지
 * 안에서만 걸러져 2쪽에 있던 글이 사라졌습니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md */
export default function FreeBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as PostSort | null) ?? 'RECENT'
  const category =
    (searchParams.get('category') as CategoryFilter | null) ?? 'ALL'
  const page = readPage(searchParams)

  const listParams = {
    // 'ALL' 은 백엔드 값이 아닙니다. 조건을 아예 빼면 전체입니다.
    category: category === 'ALL' ? undefined : category,
    sort,
    page,
    size: PAGE_SIZE,
  }

  const posts = useQuery(postListQuery(listParams))
  const trending = useQuery(trendingPerfumesQuery())

  /*
   * 메인에서 잠수로 들어왔으면 커튼이 짙은 바다색으로 덮은 채 이 신호를 기다립니다
   * (안 알려도 상한에 걷힙니다 — `shared/ui/DiveCurtain`). 잠수로 들어온 것이 아니면
   * 아무 일도 안 일어납니다.
   *
   * 기준은 **목록**입니다 — 아래에서 스피너가 갈리는 바로 그 조건입니다. 목록이 칠해지면
   * 이 화면은 다 선 것이고, 여기는 진열대처럼 뒤늦게 떠오르는 사진 벽이 없습니다.
   *
   * ⚠ 곁판(`trending`)은 안 기다립니다 — 후기 게시판과 같은 까닭입니다.
   */
  useDiveReady(!posts.isPending)

  /*
    판 제목에 지금 보고 있는 분류를 적습니다. 알약에서 '전체' 를 없앤 대신
    (아래 주석) 무엇으로 걸러진 목록인지는 제목이 말해 줍니다.
  */
  const categoryLabel =
    category === 'ALL'
      ? undefined
      : POST_CATEGORIES.find((entry) => entry.value === category)?.label

  /*
    곁판을 그릴지. 언급된 향수가 하나도 없으면 `TrendingPerfumes` 가 아무것도
    그리지 않으므로 칸도 같이 접습니다(아래 grid 주석).
  */
  const showTrending =
    trending.isPending || (trending.data?.perfumes.length ?? 0) > 0

  const queryClient = useQueryClient()

  /**
   * 좋아요 토글 (CMT-05). 비로그인 안내 · 누르기/취소 고르기는 `useLikeToggle` 이
   * 맡고, 여기서는 캐시만 고칩니다 — 응답의 `liked` · `likeCount` 를 **그 줄에만
   * 덮어씁니다.** 전체를 다시 부르면 보고 있던 자리가 흔들리고, '좋아요순' 이면
   * 방금 누른 줄이 눈앞에서 이동합니다.
   */
  const likeToggle = useLikeToggle({
    like: likePost,
    unlike: unlikePost,
    onToggled: (result) => {
      queryClient.setQueryData(
        communityKeys.posts(listParams),
        (old: typeof posts.data) =>
          old === undefined
            ? old
            : {
                ...old,
                posts: old.posts.map((post) =>
                  post.postId === result.postId
                    ? {
                        ...post,
                        liked: result.liked,
                        likeCount: result.likeCount,
                      }
                    : post,
                ),
              },
      )
      // 글 상세도 같은 숫자를 읽으므로 다음에 열 때 맞는 값이 보이게 비웁니다
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })

  const updateParams = (next: {
    sort?: PostSort
    category?: CategoryFilter
    page?: number
  }) => {
    let params = withQueryParams(searchParams, {
      ...(next.sort !== undefined && { sort: next.sort }),
      // 'ALL' 은 백엔드 값이 아닙니다 — 조건을 아예 빼면 전체입니다
      ...(next.category !== undefined && {
        category: next.category === 'ALL' ? null : next.category,
      }),
    })
    // 거르는 조건이 바뀌면 첫 쪽부터 다시 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
    if (next.sort !== undefined || next.category !== undefined) {
      params = writePage(params, 0)
    }
    if (next.page !== undefined) params = writePage(params, next.page)
    setSearchParams(params)
  }

  return (
    <div className="space-y-7.5">
      <BoardHeader
        description="향수 이야기를 자유롭게 나눕니다. 컬렉션을 남에게 보이는 유일한 길이기도 합니다."
        action={
          <AuthLinkButton
            to={ROUTES.POST_WRITE}
            size="sm"
            description="글은 로그인한 뒤에 쓸 수 있습니다."
          >
            글쓰기
          </AuthLinkButton>
        }
      />

      {/* 곁판이 없으면 한 칸으로 폅니다. 불러오는 중에는 칸을 비워 둡니다 */}
      <div
        className={cn(
          'grid gap-6.25',
          showTrending && 'lg:grid-cols-[1fr_255px]',
        )}
      >
        <div className="min-w-0 space-y-3.75">
          {/*
            분류에는 '전체' 알약이 없습니다 — 켜진 것을 다시 누르면 꺼집니다.
            정렬은 `required` 라 안 꺼집니다(꺼지면 줄 세울 기준이 없어집니다).
          */}
          <div
            role="group"
            aria-label="글 거르기"
            className="flex flex-col gap-2.5"
          >
            <PillFilter
              label="정렬"
              options={FREE_SORTS}
              value={sort}
              onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
              required
              className="flex-wrap justify-center"
            />
            <PillFilter
              label="분류"
              options={POST_CATEGORIES}
              value={category === 'ALL' ? null : category}
              onChange={(next) => updateParams({ category: next ?? 'ALL' })}
              className="flex-wrap justify-center"
            />
          </div>

          <section className={GLASS_PANEL}>
            <div className="mb-6.25 flex items-baseline gap-2.5">
              <h2 className="text-ink font-serif text-2xl">
                {categoryLabel ? `${categoryLabel} 글` : '전체 글'}
              </h2>
              {!posts.isPending && !!posts.data?.totalElements && (
                <span className="text-ink-muted text-caption">
                  {posts.data.totalElements.toLocaleString()}개
                </span>
              )}
            </div>

            <PostList
              items={(posts.data?.posts ?? []).map(postToBoardItem)}
              isPending={posts.isPending}
              emptyAction={
                <AuthLinkButton
                  to={ROUTES.POST_WRITE}
                  size="sm"
                  description="글은 로그인한 뒤에 쓸 수 있습니다."
                >
                  글쓰기
                </AuthLinkButton>
              }
              onToggleLike={(item) =>
                likeToggle.toggle({ id: item.id, liked: item.liked })
              }
            />

            <Pagination
              className="mt-6.25"
              label="자유 게시판 페이지"
              page={page}
              size={PAGE_SIZE}
              totalElements={posts.data?.totalElements ?? 0}
              onPageChange={(next) => updateParams({ page: next })}
            />
          </section>
        </div>

        <TrendingPerfumes
          items={trending.data?.perfumes ?? []}
          days={trending.data?.days}
        />
      </div>

      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_FREE}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </div>
  )
}
