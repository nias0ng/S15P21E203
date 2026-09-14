import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  BoardHeader,
  PostList,
  postListQuery,
  REVIEW_SORTS,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type PostSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { LinkButton } from '@/shared/ui/LinkButton'

/** 후기 게시판 (와이어프레임 A22a — CMT-01) */
export default function ReviewBoardPage() {
  const [sort, setSort] = useState<PostSort>('RECENT')

  const posts = useQuery(postListQuery('REVIEW'))
  const trending = useQuery(trendingPerfumesQuery())

  return (
    <div className="space-y-7.5">
      <BoardHeader
        description="향수 한 개에 대한 시향 기록입니다. 점수나 별점 없이 좋아요만 있습니다."
        action={
          <LinkButton to={ROUTES.REVIEW_WRITE} size="sm">
            후기 쓰기
          </LinkButton>
        }
      />

      <div className="grid gap-6.25 lg:grid-cols-[1fr_255px]">
        <div className="min-w-0 space-y-6.25">
          {/* 후기 게시판에는 분류 필터가 없습니다 — 전부 후기라서 */}
          <ChipToggle
            label="정렬"
            options={REVIEW_SORTS}
            value={sort}
            onChange={(next) => setSort(next ?? 'RECENT')}
          />

          {/* TODO: 정렬을 백엔드 파라미터로 넘기세요. 지금은 목록만 보여줍니다. */}
          <PostList
            posts={posts.data ?? []}
            isPending={posts.isPending}
            emptyAction={
              <LinkButton to={ROUTES.REVIEW_WRITE} size="sm">
                후기 쓰기
              </LinkButton>
            }
          />
        </div>

        <TrendingPerfumes items={trending.data ?? []} />
      </div>
    </div>
  )
}
