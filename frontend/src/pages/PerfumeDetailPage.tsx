import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import {
  perfumeDetailQuery,
  PerfumeNotes,
  perfumeNotesQuery,
  PerfumeOverview,
  PerfumeReviewList,
  perfumeReviewsQuery,
  perfumeReviewStatisticsQuery,
  PerfumeRelated,
  relatedPerfumesQuery,
  PerfumeReviewKeywords,
  perfumeReviewKeywordsQuery,
  PerfumeReviewSummary,
  perfumeReviewSummaryQuery,
  PerfumeSeasonRatings,
  perfumeSeasonStatisticsQuery,
  usePerfumeViewLog,
} from '@/features/perfume'
// 진열대 저장은 진열대 도메인의 어휘라, features 끼리 import 하지 않고 화면에서 조합합니다
import {
  ShelfRegisterModal,
  ShelfRegisterPartialError,
  shelfItemsQuery,
  useShelfActions,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import {
  PERFUME_VIEW_BACK_LABEL,
  readPerfumeViewState,
} from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/** 후기 목록 한 페이지 크기. 백엔드 기본값과 같습니다. */
const REVIEW_PAGE_SIZE = 10

/**
 * 향수 상세 (A10 — DTL-01 · 02 · 03 · 10 · 12 · 15). 계절 등록(DTL-16)은 이 화면이
 * 아니라 후기 작성 화면(A24a)에 있습니다.
 *
 * 구역마다 엔드포인트가 따로라, 기본 정보만 전체 실패로 다루고 나머지 넷은 각자 비어
 * 있는 모습으로 자리를 지킵니다 — 향조를 못 불러왔다고 후기까지 사라지면 안 됩니다.
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)
  const enabled = Number.isFinite(numericId)

  // 들어온 길은 보낸 쪽이 state 로 실어 줍니다 — 주소를 복사해 열거나 새로 고치면
  // 비어서 `DIRECT` 가 됩니다
  const { state } = useLocation()
  const { source, fromPerfumeId } = readPerfumeViewState(state)
  usePerfumeViewLog(numericId, source, fromPerfumeId)

  /*
    뒤로 가기: 들어온 길을 알면 주소를 새로 짜지 않고 기록을 한 칸 되돌립니다 — 그래야
    앞 화면의 필터 · 쪽 번호 · 스크롤 자리까지 돌아옵니다. `DIRECT` 면 돌아갈 기록이
    없어(주소 붙여넣기 · 밖에서 온 링크) 향수 목록으로 보냅니다.
  */
  const navigate = useNavigate()
  const knowsOrigin = source !== 'DIRECT'

  const [shelfOpen, setShelfOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()

  const actions = useShelfActions()

  // 이 향수가 이미 내 진열대에 있는지 — 단추가 [저장] ↔ [해제] 로 갈리고, 뺄 때 필요한
  // `shelfItemId` 도 이 목록에만 있습니다
  // TODO: 상세 응답의 `myShelfItemId` 가 오면 이 쿼리를 지웁니다
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
  const seasons = useQuery({
    ...perfumeSeasonStatisticsQuery(numericId),
    enabled,
  })
  const related = useQuery({ ...relatedPerfumesQuery(numericId), enabled })
  const reviewKeywords = useQuery({
    ...perfumeReviewKeywordsQuery(numericId),
    enabled,
  })

  const summary = useQuery({
    ...perfumeReviewSummaryQuery(numericId),
    enabled,
  })
  const reviewStatistics = useQuery({
    ...perfumeReviewStatisticsQuery(numericId),
    enabled,
  })
  const reviews = useQuery({
    ...perfumeReviewsQuery(numericId, {
      page: reviewPage,
      size: REVIEW_PAGE_SIZE,
    }),
    enabled,
  })

  if (isPending) return <PageFallback />
  if (isError) {
    return (
      <EmptyState
        title="향수 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

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

      <PerfumeOverview
        perfume={data}
        inShelf={shelfItem !== null}
        // 진열대를 받는 동안에는 [저장] 인지 [해제] 인지 모릅니다
        shelfPending={isLoggedIn && myShelf.isPending}
        // 비로그인은 로그인 유도 모달입니다 (C01) — 그냥 열면 분류까지 고른 뒤 401 입니다
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
        seasons={seasons.data?.seasons ?? []}
        isPending={seasons.isPending}
      />

      <PerfumeReviewSummary
        summary={summary.data?.summary ?? null}
        sourceReviewCount={summary.data?.sourceReviewCount ?? null}
        isPending={summary.isPending}
      />

      <PerfumeReviewKeywords keywords={reviewKeywords.data ?? []} />

      <PerfumeReviewList
        reviews={reviews.data?.reviews ?? []}
        // 전체 개수는 후기 통계가 정본입니다 — 쪽을 넘기는 동안 값이 흔들리지 않습니다
        totalElements={
          reviewStatistics.data?.reviewCount ?? reviews.data?.totalElements ?? 0
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

      {/* 진열대 화면(A15)과 같은 모달이고, `preselected` 면 향수 고르기를 건너뜁니다 */}
      <ShelfRegisterModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        options={[]}
        onSearch={() => {}}
        preselected={{
          perfumeId: data.perfumeId,
          name: data.nameKo ?? data.name,
          brand: data.brand?.name ?? null,
          thumbnailUrl: data.images[0] ?? null,
        }}
        onSubmit={(input) => {
          setShelfOpen(false)
          actions.register.mutate(input, {
            onSuccess: () => showToast('진열대에 저장했습니다'),
            onError: (error) =>
              showToast(
                error instanceof ShelfRegisterPartialError
                  ? `진열대에 담았지만 ${error.missing.join(' · ')}은(는) 저장하지 못했습니다`
                  : isApiError(error)
                    ? error.message
                    : '진열대에 저장하지 못했습니다.',
              ),
          })
        }}
      />
      {/*
        진열대에서 빼기 (SHF-04). 무엇이 함께 지워지는지 적습니다 — 이 화면에는
        진열대 카드가 없어서 메모 · 적합도가 거기 딸려 있다는 것이 보이지 않습니다.
      */}
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={`'${data.nameKo ?? data.name}' 를 진열대에서 뺄까요?`}
        description="적어 둔 메모와 취향 적합도가 함께 지워집니다. 되돌릴 수 없습니다."
        confirmLabel="빼기"
        isLoading={actions.remove.isPending}
        onConfirm={() => {
          if (!shelfItem) return
          actions.remove.mutate(
            { shelfItemId: shelfItem.shelfItemId },
            {
              onSuccess: () => {
                setRemoveOpen(false)
                showToast('진열대에서 뺐습니다')
              },
              onError: () => {
                setRemoveOpen(false)
                showToast('진열대에서 빼지 못했습니다')
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
