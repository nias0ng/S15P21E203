import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('community')
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
        label: t('reviewBoard.write'),
        description: t('reviewBoard.writeLoginRequired'),
      }}
      filters={
        <PillFilter
          label={t('board.sortLabel')}
          options={REVIEW_SORTS.map((option) => ({
            value: option.value,
            label: t(`sorts.${option.value}`),
          }))}
          value={sort}
          onChange={(next) => updateParams({ sort: next ?? 'RECENT' })}
          required
          className="flex-wrap justify-center"
        />
      }
      title={boardTitle(sort, t('reviewBoard.noun'))}
      items={(reviews.data?.reviews ?? []).map(reviewToBoardItem)}
      isPending={reviews.isPending}
      totalElements={reviews.data?.totalElements}
      onToggleLike={(item) =>
        likeToggle.toggle({ id: item.id, liked: item.liked })
      }
      page={page}
      size={PAGE_SIZE}
      onPageChange={(next) => updateParams({ page: next })}
      paginationLabel={t('reviewBoard.pagination')}
    >
      <LoginRequiredDialog
        open={likeToggle.loginRequired}
        onClose={likeToggle.closeLoginRequired}
        redirectTo={ROUTES.COMMUNITY_REVIEWS}
        description={t('board.likeLoginRequired')}
      />
    </BoardShell>
  )
}
