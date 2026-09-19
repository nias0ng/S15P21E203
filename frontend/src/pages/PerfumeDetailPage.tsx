import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useParams } from 'react-router'

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
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import {
  ShelfRegisterModal,
  ShelfRegisterPartialError,
  shelfItemsQuery,
  useShelfActions,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { readPerfumeViewState } from '@/shared/config/perfumeViewSource'
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
 * 향수 상세 (A10 — DTL-01 · 02 · 03 · 10 · 12 · 15)
 *
 * 다섯 구역(개요 · 향조 · 계절 · AI 요약 · 후기)을 조립합니다. 계절 등록(DTL-16)은
 * 이 화면이 아니라 후기 작성 화면(A24a)에 있습니다.
 *
 * **구역마다 엔드포인트가 따로입니다.** 기본 정보만 전체 실패로 다루고 나머지 넷은
 * 각자 비어 있는 모습으로 자리를 지킵니다 — 향조를 못 불러왔다고 후기까지 사라지면
 * 안 됩니다. 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)
  const enabled = Number.isFinite(numericId)

  /*
    들어온 길은 **보낸 쪽이 실어 줍니다.** 이 화면은 자기가 어디서 불렸는지 모릅니다.
    주소를 복사해 열거나 새로 고치면 state 가 비어 `DIRECT` 가 됩니다.
  */
  const { state } = useLocation()
  const { source, fromPerfumeId } = readPerfumeViewState(state)
  usePerfumeViewLog(numericId, source, fromPerfumeId)

  const [shelfOpen, setShelfOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()

  /**
   * 진열대에 담기 (SHF-01). 대상 향수를 이미 알고 있어 분류만 받으면 되고,
   * 요청이 하나로 끝나 부분 실패가 없습니다.
   */
  const actions = useShelfActions()

  /*
   * 이 향수가 이미 내 진열대에 있는지 — 단추가 [저장] ↔ [해제] 로 갈리고, 뺄 때
   * 필요한 `shelfItemId` 도 이 목록에만 있습니다.
   *
   * ⚠️ **내 진열대를 통째로 받아 찾습니다.** `myReviewId` 같은 값이 진열대에는
   * 없어서입니다 — `myShelfItemId` 를 BE 에 요청해 뒀고, 오면 이 쿼리는 지웁니다.
   * 캐시(`shelfKeys.items()`)는 진열대 화면과 함께 씁니다.
   */
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
      {/* 들어온 길(`perfumeViewSource`)로 되돌리지 않고 향수 목록으로 고정합니다 */}
      <LinkButton to={ROUTES.PERFUMES} variant="outline" size="sm">
        ← 향수 목록
      </LinkButton>

      <PerfumeOverview
        perfume={data}
        inShelf={shelfItem !== null}
        // 진열대를 받는 동안에는 [저장] 인지 [해제] 인지 모릅니다
        shelfPending={isLoggedIn && myShelf.isPending}
        /*
          비로그인은 로그인 유도 모달입니다 (C01) — 그냥 열면 분류까지 고른 뒤
          401 로 튕깁니다. 이미 담긴 향수는 되돌릴 수 없어 확인을 받습니다.
        */
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

      {/* 값이 없으면 아무것도 그리지 않습니다 — 아직 적재 전입니다 */}
      <PerfumeReviewKeywords keywords={reviewKeywords.data ?? []} />

      <PerfumeReviewList
        reviews={reviews.data?.reviews ?? []}
        // 전체 개수는 후기 통계가 정본입니다. 목록 응답의 totalElements 와 같지만,
        // 페이지를 넘기는 동안에도 값이 흔들리지 않습니다.
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

      {/* 관계가 없는 향수(향 지도 밖)에서는 구역이 그려지지 않습니다 */}
      <PerfumeRelated
        fromPerfumeId={numericId}
        perfumes={related.data ?? []}
        isPending={related.isPending}
      />

      {/*
        진열대 화면(A15)과 **같은 등록 모달**입니다. `preselected` 를 넘기면 향수
        고르기를 건너뛰고 분류 · 적합도 · 메모를 적는 2단계로 바로 엽니다.
      */}
      <ShelfRegisterModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        options={[]}
        onSearch={() => {}}
        preselected={{
          perfumeId: data.perfumeId,
          name: data.nameKo ?? data.name,
          // 상세는 브랜드가 객체이고 사진은 배열의 첫 장입니다
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
        진열대에서 빼기 (SHF-04). 문구는 진열대 화면의 [빼기] 와 같은 틀이되,
        **무엇이 함께 지워지는지**를 적습니다 — 이 화면에는 진열대 카드가 없어서
        메모 · 적합도가 거기 딸려 있다는 것이 보이지 않습니다.
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
