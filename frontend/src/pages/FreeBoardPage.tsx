import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BoardHeader,
  FREE_SORTS,
  POST_CATEGORY_FILTERS,
  PostList,
  postListQuery,
  postToBoardItem,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type PostCategory,
  type PostSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { LinkButton } from '@/shared/ui/LinkButton'
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

  const posts = useQuery(
    postListQuery({
      // 'ALL' 은 백엔드 값이 아닙니다. 조건을 아예 빼면 전체입니다.
      category: category === 'ALL' ? undefined : category,
      sort,
      page,
      size: PAGE_SIZE,
    }),
  )
  const trending = useQuery(trendingPerfumesQuery())

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
          <LinkButton to={ROUTES.POST_WRITE} size="sm">
            글쓰기
          </LinkButton>
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
              <LinkButton to={ROUTES.POST_WRITE} size="sm">
                글쓰기
              </LinkButton>
            }
          />

          <Pagination
            label="자유 게시판 페이지"
            page={page}
            size={PAGE_SIZE}
            totalElements={posts.data?.totalElements ?? 0}
            onPageChange={(next) => updateParams({ page: next })}
          />
        </div>

        <TrendingPerfumes items={trending.data ?? []} />
      </div>
    </div>
  )
}
