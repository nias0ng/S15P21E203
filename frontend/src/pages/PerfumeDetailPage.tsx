import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'

import {
  perfumeDetailQuery,
  PerfumeNotes,
  perfumeNotesQuery,
  PerfumeOverview,
  PerfumeReviewList,
  perfumeReviewAggregatesQuery,
  perfumeReviewsQuery,
  PerfumeRelated,
  relatedPerfumesQuery,
  PerfumeReviewKeywords,
  PerfumeReviewSummary,
  PerfumeSeasonRatings,
  usePerfumeViewLog,
} from '@/features/perfume'
import {
  ShelfRegisterModal,
  shelfItemsQuery,
  shelfRegisterErrorMessage,
  useShelfActions,
} from '@/features/shelf'
import {
  PERFUME_VIEW_BACK_LABEL,
  readPerfumeViewState,
} from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { localizedName } from '@/shared/i18n/locale'
import { parseId } from '@/shared/lib/parseId'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { useLocale } from '@/shared/store/localeStore'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

const REVIEW_PAGE_SIZE = 10

export default function PerfumeDetailPage() {
  const { t } = useTranslation('perfume')
  const locale = useLocale()
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const parsedId = parseId(perfumeId)
  const enabled = parsedId !== null
  const numericId = parsedId ?? 0

  const { state } = useLocation()
  const { source, fromPerfumeId } = readPerfumeViewState(state)
  usePerfumeViewLog(parsedId, source, fromPerfumeId)

  const navigate = useNavigate()
  const knowsOrigin = source !== 'DIRECT'

  const [shelfOpen, setShelfOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()

  const actions = useShelfActions()

  // NOTE: 상세 응답의 `myShelfItemId` 가 오면 이 쿼리를 지웁니다
  const myShelf = useQuery({ ...shelfItemsQuery(), enabled: isLoggedIn })
  const shelfItem =
    myShelf.data?.find((item) => item.perfumeId === numericId) ?? null

  const [reviewPage, setReviewPage] = useState(0)
  const { showToast, toastProps } = useToast()

  const { data, isPending, isError, refetch } = useQuery({
    ...perfumeDetailQuery(numericId),
    enabled,
  })

  const notes = useQuery({ ...perfumeNotesQuery(numericId), enabled })
  const related = useQuery({ ...relatedPerfumesQuery(numericId), enabled })
  const aggregates = useQuery({
    ...perfumeReviewAggregatesQuery(numericId),
    enabled,
  })
  const reviews = useQuery({
    ...perfumeReviewsQuery(numericId, {
      page: reviewPage,
      size: REVIEW_PAGE_SIZE,
    }),
    enabled,
  })

  if (enabled && isPending) return <PageFallback />
  if (isError || !data) {
    return (
      <EmptyState
        title={t('detail.loadErrorTitle')}
        description={t('detail.loadErrorDescription')}
        onRetry={enabled ? () => refetch() : undefined}
      />
    )
  }

  const displayName = localizedName(locale, data.name, data.nameKo)

  return (
    <div className="space-y-6.25">
      {knowsOrigin ? (
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          ← {PERFUME_VIEW_BACK_LABEL[source]}
        </Button>
      ) : (
        <LinkButton to={ROUTES.PERFUMES} variant="outline" size="sm">
          ← {PERFUME_VIEW_BACK_LABEL.DIRECT}
        </LinkButton>
      )}

      <div className="type-reading space-y-6.25">
        <PerfumeOverview
          perfume={data}
          inShelf={shelfItem !== null}
          shelfPending={isLoggedIn && myShelf.isPending}
          onShelfAction={() => {
            if (!isLoggedIn) {
              setLoginOpen(true)
              return
            }
            if (shelfItem) {
              setRemoveOpen(true)
              return
            }
            setShelfOpen(true)
          }}
          aside={
            <PerfumeNotes
              notes={notes.data?.notes ?? []}
              isPending={notes.isPending}
              className="flex-1"
            />
          }
        />

        <PerfumeSeasonRatings
          seasons={aggregates.data?.seasonStatistics.seasons ?? []}
          isPending={aggregates.isPending}
        />

        <PerfumeReviewSummary
          summary={aggregates.data?.reviewSummary.summary ?? null}
          sourceReviewCount={
            aggregates.data?.reviewSummary.sourceReviewCount ?? null
          }
          isPending={aggregates.isPending}
        />

        <PerfumeReviewKeywords
          keywords={aggregates.data?.reviewKeywords.keywords ?? []}
        />

        <PerfumeReviewList
          reviews={reviews.data?.reviews ?? []}
          totalElements={
            aggregates.data?.reviewStatistics.reviewCount ??
            reviews.data?.totalElements ??
            0
          }
          page={reviewPage}
          size={REVIEW_PAGE_SIZE}
          onPageChange={setReviewPage}
          isPending={reviews.isPending}
          myReviewId={data.myReviewId}
          perfumeId={numericId}
        />

        <PerfumeRelated
          fromPerfumeId={numericId}
          perfumes={related.data ?? []}
          isPending={related.isPending}
        />
      </div>

      <ShelfRegisterModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        preselected={{
          perfumeId: data.perfumeId,
          name: displayName,
          brand: data.brand?.name ?? null,
          thumbnailUrl: data.images[0] ?? null,
        }}
        onSubmit={(input) => {
          setShelfOpen(false)
          actions.register.mutate(input, {
            onSuccess: () => showToast(t('detail.shelfSaved')),
            onError: (error) => showToast(shelfRegisterErrorMessage(error)),
          })
        }}
      />
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={t('detail.removeTitle', { name: displayName })}
        description={t('detail.removeDescription')}
        confirmLabel={t('detail.removeConfirm')}
        isLoading={actions.remove.isPending}
        onConfirm={() => {
          if (!shelfItem) return
          actions.remove.mutate(
            { shelfItemId: shelfItem.shelfItemId },
            {
              onSuccess: () => {
                setRemoveOpen(false)
                showToast(t('detail.removed'))
              },
              onError: () => {
                setRemoveOpen(false)
                showToast(t('detail.removeFailed'))
              },
            },
          )
        }}
      />
      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toPerfumeDetail(numericId)}
      />
      <Toast {...toastProps} />
    </div>
  )
}
