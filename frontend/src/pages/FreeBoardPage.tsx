import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  BoardTabs,
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
 * 와이어프레임 주석:
 * - 정렬 네 가지와 분류 필터 네 가지를 겹쳐 쓴다
 * - 자유 글에는 향수를 걸지 않아도 된다 — 걸면 후기와 같은 향수 블록이 붙는다
 * - 컬렉션 공유 글은 내 컬렉션(A17)을 첨부한 글 — 컬렉션을 남에게 보이는 유일한 길
 * - [글쓰기] → A24b
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
    <div className="space-y-4">
      <h1 className="sr-only">자유 게시판</h1>
      <BoardTabs />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-3">
          {/* 정렬과 분류 필터를 겹쳐 씁니다 */}
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle
              label="정렬"
              options={FREE_SORTS}
              value={sort}
              onChange={(next) => setSort(next ?? 'RECENT')}
            />
            <LinkButton to={ROUTES.POST_WRITE} className="ml-auto">
              글쓰기
            </LinkButton>
          </div>

          <ChipToggle
            label="분류"
            options={POST_CATEGORY_FILTERS}
            value={category}
            onChange={(next) => setCategory(next ?? 'ALL')}
          />

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
