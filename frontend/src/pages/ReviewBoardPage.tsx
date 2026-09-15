import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BoardHeader,
  PostList,
  REVIEW_SORTS,
  reviewBoardQuery,
  reviewToBoardItem,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type ReviewSort,
} from '@/features/community'
import { ROUTES } from '@/shared/config/routes'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Pagination } from '@/shared/ui/Pagination'

/** 백엔드 기본값과 같습니다 */
const PAGE_SIZE = 10

/**
 * 후기 게시판 (와이어프레임 A22a — CMT-01)
 *
 * 정렬과 쪽 번호를 URL 쿼리에 둡니다. 새로고침 · 뒤로가기 · 링크 공유가 같은
 * 결과를 보여주게 하려는 것입니다. **URL 의 page 는 1부터**이고 백엔드는 0부터라
 * 여기서 한 번 바꿉니다 — 주소창에 `page=0` 이 보이면 사람이 읽기 어렵습니다.
 *
 * 줄을 누르면 후기 상세(A12)로 갑니다. 향수 상세에서 후기를 눌렀을 때와 같은
 * 화면입니다 — 게시판용 상세를 따로 두면 같은 후기가 두 주소를 갖게 됩니다.
 */
export default function ReviewBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = (searchParams.get('sort') as ReviewSort | null) ?? 'RECENT'
  const page = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  const reviews = useQuery(reviewBoardQuery({ sort, page, size: PAGE_SIZE }))
  const trending = useQuery(trendingPerfumesQuery())

  const updateParams = (next: { sort?: ReviewSort; page?: number }) => {
    const params = new URLSearchParams(searchParams)
    if (next.sort !== undefined) {
      params.set('sort', next.sort)
      // 정렬을 바꾸면 첫 쪽부터 다시 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
      params.delete('page')
    }
    if (next.page !== undefined) params.set('page', String(next.page + 1))
    setSearchParams(params)
  }

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
            onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
          />

          <PostList
            items={(reviews.data?.reviews ?? []).map(reviewToBoardItem)}
            isPending={reviews.isPending}
            emptyAction={
              <LinkButton to={ROUTES.REVIEW_WRITE} size="sm">
                후기 쓰기
              </LinkButton>
            }
          />

          <Pagination
            label="후기 게시판 페이지"
            page={page}
            size={PAGE_SIZE}
            totalElements={reviews.data?.totalElements ?? 0}
            onPageChange={(next) => updateParams({ page: next })}
          />
        </div>

        <TrendingPerfumes items={trending.data ?? []} />
      </div>
    </div>
  )
}
