import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  BoardHeader,
  FREE_SORTS,
  POST_CATEGORY_FILTERS,
  PostList,
  postListQuery,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type PostCategory,
  type PostSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { LinkButton } from '@/shared/ui/LinkButton'

type CategoryFilter = PostCategory | 'ALL'

/**
 * 자유 게시판 (와이어프레임 A22b — CMT-01)
 *
 * 컬렉션 공유 글은 컬렉션을 남에게 보이는 **유일한 길**입니다.
 */
export default function FreeBoardPage() {
  const [sort, setSort] = useState<PostSort>('RECENT')
  const [category, setCategory] = useState<CategoryFilter>('ALL')

  const posts = useQuery(postListQuery('FREE'))
  const trending = useQuery(trendingPerfumesQuery())

  const filtered = (posts.data ?? []).filter(
    (post) => category === 'ALL' || post.category === category,
  )

  return (
    <div className="space-y-8">
      <BoardHeader
        description="향수 이야기를 자유롭게 나눕니다. 컬렉션을 남에게 보이는 유일한 길이기도 합니다."
        action={
          <LinkButton to={ROUTES.POST_WRITE} size="sm">
            글쓰기
          </LinkButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-6">
          {/*
            정렬과 분류를 두 줄로 둡니다. 자유 게시판은 칩이 여덟 개(4+4)라 한 줄에
            넣으면 목록 폭(840px)을 넘어 줄바꿈이 제멋대로 일어납니다.
            두 줄 사이는 gap-2 로 붙여서 한 덩어리로 읽히게 합니다.
          */}
          <div
            role="group"
            aria-label="글 거르기"
            className="flex flex-col gap-2"
          >
            <ChipToggle
              label="정렬"
              options={FREE_SORTS}
              value={sort}
              onChange={(next) => setSort(next ?? 'RECENT')}
            />
            <ChipToggle
              label="분류"
              options={POST_CATEGORY_FILTERS}
              value={category}
              onChange={(next) => setCategory(next ?? 'ALL')}
            />
          </div>

          {/* TODO: 정렬 · 분류를 백엔드 파라미터로 넘기세요. 지금은 분류만 화면에서 거릅니다. */}
          <PostList
            posts={filtered}
            isPending={posts.isPending}
            emptyAction={
              <LinkButton to={ROUTES.POST_WRITE} size="sm">
                글쓰기
              </LinkButton>
            }
          />
        </div>

        <TrendingPerfumes items={trending.data ?? []} />
      </div>
    </div>
  )
}
