import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  boardTitle,
  BoardShell,
  communityKeys,
  REVIEW_SORTS,
  reviewBoardQuery,
  reviewToBoardItem,
  type ReviewSort,
} from '@/features/community'
import { likeReview, reviewKeys, unlikeReview } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useLikeToggle } from '@/shared/hooks/useLikeToggle'
import {
  readOption,
  readPage,
  withQueryParams,
  writePage,
} from '@/shared/lib/queryParams'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PillFilter } from '@/shared/ui/PillFilter'

const PAGE_SIZE = 10

export default function ReviewBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = readOption(searchParams.get('sort'), REVIEW_SORTS) ?? 'RECENT'
  const page = readPage(searchParams)

  const reviews = useQuery(reviewBoardQuery({ sort, page, size: PAGE_SIZE }))

  useDiveReady(!reviews.isPending)

  const queryClient = useQueryClient()
  const boardKey = communityKeys.reviewBoard({ sort, page, size: PAGE_SIZE })

  const likeToggle = useLikeToggle({
    like: likeReview,
    unlike: unlikeReview,
    onToggled: (result) => {
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
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })

  const updateParams = (next: { sort?: ReviewSort; page?: number }) => {
    let params = searchParams
    if (next.sort !== undefined) {
      params = writePage(withQueryParams(params, { sort: next.sort }), 0)
    }
    if (next.page !== undefined) params = writePage(params, next.page)
    setSearchParams(params)
  }

  return (
    <BoardShell
      write={{
        to: ROUTES.REVIEW_WRITE,
        label: '후기 쓰기',
        description: '후기는 로그인한 뒤에 쓸 수 있습니다.',
      }}
      filters={
        <PillFilter
          label="정렬"
          options={REVIEW_SORTS}
          value={sort}
          onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
          required
          className="flex-wrap justify-center"
        />
      }
      title={boardTitle(sort, '후기')}
      items={(reviews.data?.reviews ?? []).map(reviewToBoardItem)}
      isPending={reviews.isPending}
      totalElements={reviews.data?.totalElements}
      onToggleLike={(item) =>
        likeToggle.toggle({ id: item.id, liked: item.liked })
      }
      page={page}
      size={PAGE_SIZE}
      onPageChange={(next) => updateParams({ page: next })}
      paginationLabel="후기 게시판 페이지"
    >
      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_REVIEWS}
        description="좋아요는 로그인한 뒤에 누를 수 있습니다. 글은 로그인 없이도 읽을 수 있습니다."
      />
    </BoardShell>
  )
}
