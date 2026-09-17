import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  BoardHeader,
  communityKeys,
  FREE_SORTS,
  likePost,
  POST_CATEGORY_FILTERS,
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
import { useIsLoggedIn } from '@/shared/store/authStore'
import { AuthLinkButton } from '@/shared/ui/AuthLinkButton'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Pagination } from '@/shared/ui/Pagination'

type CategoryFilter = PostCategory | 'ALL'

/** 백엔드 기본값과 같습니다 */
const PAGE_SIZE = 20

/**
 * 자유 게시판 (와이어프레임 A22b — CMT-01)
 *
 * 컬렉션 공유 글은 컬렉션을 남에게 보이는 **유일한 길**입니다.
 *
 * **분류 · 정렬 · 쪽을 전부 서버가 처리합니다.** 예전에는 한 번 받아 온 목록을
 * 화면에서 걸렀는데, 그러면 그 페이지 안에서만 걸러져 2쪽에 있던 잡담 글이
 * 사라집니다. 셋 다 URL 쿼리에 두어 새로고침 · 뒤로가기 · 링크 공유가 같은 결과를
 * 보여줍니다.
 */
export default function FreeBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as PostSort | null) ?? 'RECENT'
  const category =
    (searchParams.get('category') as CategoryFilter | null) ?? 'ALL'
  const page = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  const listParams = {
    // 'ALL' 은 백엔드 값이 아닙니다. 조건을 아예 빼면 전체입니다.
    category: category === 'ALL' ? undefined : category,
    sort,
    page,
    size: PAGE_SIZE,
  }

  const posts = useQuery(postListQuery(listParams))
  const trending = useQuery(trendingPerfumesQuery())

  const queryClient = useQueryClient()
  const isLoggedIn = useIsLoggedIn()
  const [loginOpen, setLoginOpen] = useState(false)

  /**
   * 좋아요 토글 (CMT-05). 후기 게시판과 같은 방식입니다.
   *
   * 응답에 `liked` 와 `likeCount` 가 함께 오므로 화면이 숫자를 직접 더하지 않습니다 —
   * 그 사이 다른 사람이 누른 것도 같이 반영됩니다. 그래서 목록을 다시 부르지 않고
   * **응답 값을 그 줄에만 덮어씁니다.** 전체를 다시 부르면 보고 있던 자리가 흔들리고,
   * 정렬이 '좋아요순'이면 방금 누른 줄이 눈앞에서 이동합니다.
   *
   * 누르기와 취소가 서로 다른 메서드라 따닥 눌러도 결과가 하나로 정해집니다.
   */
  const toggleLike = useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      liked ? unlikePost(id) : likePost(id),
    onSuccess: (result) => {
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
    const params = new URLSearchParams(searchParams)
    if (next.sort !== undefined) params.set('sort', next.sort)
    if (next.category !== undefined) {
      if (next.category === 'ALL') params.delete('category')
      else params.set('category', next.category)
    }
    // 거르는 조건이 바뀌면 첫 쪽부터 다시 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
    if (next.sort !== undefined || next.category !== undefined) {
      params.delete('page')
    }
    if (next.page !== undefined) params.set('page', String(next.page + 1))
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

      <div className="grid gap-6.25 lg:grid-cols-[1fr_255px]">
        <div className="min-w-0 space-y-6.25">
          {/*
            정렬과 분류를 두 줄로 둡니다. 자유 게시판은 칩이 여덟 개(4+4)라 한 줄에
            넣으면 좁은 화면의 목록 폭(1024 에서 약 660px)을 넘어 줄바꿈이 제멋대로 일어납니다.
            두 줄 사이는 gap-2.5 로 붙여서 한 덩어리로 읽히게 합니다.
          */}
          <div
            role="group"
            aria-label="글 거르기"
            className="flex flex-col gap-2.5"
          >
            <ChipToggle
              label="정렬"
              options={FREE_SORTS}
              value={sort}
              onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
            />
            <ChipToggle
              label="분류"
              options={POST_CATEGORY_FILTERS}
              value={category}
              onChange={(next) => updateParams({ category: next ?? 'ALL' })}
            />
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
            onToggleLike={(item) => {
              // 비로그인은 401 이라, 보내 보는 대신 먼저 안내합니다
              if (!isLoggedIn) {
                setLoginOpen(true)
                return
              }
              toggleLike.mutate({ id: item.id, liked: item.liked })
            }}
          />

          <Pagination
            label="자유 게시판 페이지"
            page={page}
            size={PAGE_SIZE}
            totalElements={posts.data?.totalElements ?? 0}
            onPageChange={(next) => updateParams({ page: next })}
          />
        </div>

        <TrendingPerfumes
          items={trending.data?.perfumes ?? []}
          days={trending.data?.days}
        />
      </div>

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={ROUTES.COMMUNITY_FREE}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </div>
  )
}
