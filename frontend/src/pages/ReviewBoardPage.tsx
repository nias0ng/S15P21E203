import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  BoardHeader,
  communityKeys,
  PostList,
  REVIEW_SORTS,
  reviewBoardQuery,
  reviewToBoardItem,
  TrendingPerfumes,
  trendingPerfumesQuery,
  type ReviewSort,
} from '@/features/community'
// 좋아요는 후기 자원(`/reviews/{id}/like`)이라 향수 도메인에 있습니다.
// 두 도메인은 서로 import 할 수 없으므로 화면에서 조합합니다.
import { likeReview, reviewKeys, unlikeReview } from '@/features/perfume'
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

  const queryClient = useQueryClient()
  const boardKey = communityKeys.reviewBoard({ sort, page, size: PAGE_SIZE })

  /**
   * 좋아요 토글 (CMT-05).
   *
   * 응답에 `liked` 와 `likeCount` 가 함께 오므로 화면이 숫자를 직접 더하고 빼지
   * 않습니다 — 그 사이 다른 사람이 누른 것도 같이 반영됩니다. 그래서 무효화 대신
   * **응답 값을 그 줄에만 덮어씁니다.** 목록 전체를 다시 부르면 보고 있던 자리가
   * 흔들리고, 정렬이 '좋아요순'이면 방금 누른 줄이 눈앞에서 이동합니다.
   *
   * 서버가 멱등이라(이미 누른 것에 또 눌러도 같은 결과) 따닥 누름을 막지 않습니다.
   */
  const toggleLike = useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      liked ? unlikeReview(id) : likeReview(id),
    onSuccess: (result) => {
      queryClient.setQueryData(boardKey, (old: typeof reviews.data) =>
        old === undefined
          ? old
          : {
              ...old,
              reviews: old.reviews.map((review) =>
                review.reviewId === result.reviewId
                  ? {
                      ...review,
                      liked: result.liked,
                      likeCount: result.likeCount,
                    }
                  : review,
              ),
            },
      )
      // 후기 상세는 숫자를 읽기만 하므로, 다음에 열 때 맞는 값이 보이게 비웁니다
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })

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
            onToggleLike={(item) =>
              toggleLike.mutate({ id: item.id, liked: item.liked })
            }
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

        <TrendingPerfumes
          items={trending.data?.perfumes ?? []}
          days={trending.data?.days}
        />
      </div>
    </div>
  )
}
