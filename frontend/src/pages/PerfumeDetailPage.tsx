import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import {
  perfumeDetailQuery,
  PerfumeNotes,
  perfumeNotesQuery,
  PerfumeOverview,
  PerfumeReviewList,
  perfumeReviewsQuery,
  perfumeReviewStatisticsQuery,
  PerfumeReviewSummary,
  perfumeReviewSummaryQuery,
  PerfumeSeasonRatings,
  perfumeSeasonStatisticsQuery,
} from '@/features/perfume'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import {
  ShelfRegisterModal,
  ShelfRegisterPartialError,
  useShelfActions,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/** 후기 목록 한 페이지 크기. 백엔드 기본값과 같습니다. */
const REVIEW_PAGE_SIZE = 10

/**
 * 향수 상세 (와이어프레임 A10 — DTL-01 · 02 · 03 · 10 · 12 · 15)
 *
 * 다섯 개 구역(개요 · 향조 · 계절 · AI 요약 · 후기)을 조립합니다. 마크업은
 * features/perfume/components/ 안에 있습니다.
 * 계절 등록(DTL-16)은 이 화면이 아니라 후기 작성 화면(A24a)에 있습니다.
 *
 * **구역마다 엔드포인트가 따로입니다.** 기본 정보가 없으면 화면 자체가 없는 것이라
 * 그것만 전체 실패로 다루고, 나머지 넷은 각자 비어 있는 모습으로 자기 자리를
 * 지킵니다 — 향조를 못 불러왔다고 후기까지 사라지면 안 됩니다.
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)
  const enabled = Number.isFinite(numericId)

  const [shelfOpen, setShelfOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()

  /**
   * 진열대에 담기 (SHF-01) — 향수 상세의 입구입니다.
   *
   * 대상 향수는 이 화면이 이미 알고 있어 분류만 받으면 됩니다. 적합도 · 메모는
   * 여기서 받지 않습니다(진열대 화면의 등록 모달에만 있습니다) — 그래서 요청이
   * 하나로 끝나고, 나눠 보낼 때 생기는 부분 실패가 없습니다.
   */
  const actions = useShelfActions()
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
    /*
      구역마다 종이보다 밝은 판을 깔고 사이를 여백으로 띄웁니다. 예전에는 다섯
      구역이 테두리 상자 하나 안에 가로줄로 나뉘어 있었는데(divide-y), 바탕이
      종이가 되면서 상자 안팎이 같은 색이 되어 구분이 사라졌습니다.
      판 모양은 features/perfume/components/detailSection.ts 에 있습니다.
    */
    <div className="space-y-4">
      <PerfumeOverview
        perfume={data}
        /*
          비로그인이면 저장 모달 대신 로그인 유도 모달을 띄웁니다 (공통 규칙 C01).
          그냥 열어 두면 분류까지 고른 뒤 401 로 튕겨, 사용자가 한 일이 버려집니다.
        */
        onSaveToShelf={() =>
          isLoggedIn ? setShelfOpen(true) : setLoginOpen(true)
        }
      />

      <PerfumeNotes
        notes={notes.data?.notes ?? []}
        isPending={notes.isPending}
      />

      <PerfumeSeasonRatings
        seasons={seasons.data?.seasons ?? []}
        isPending={seasons.isPending}
      />

      <PerfumeReviewSummary
        summary={summary.data?.summary ?? null}
        sourceReviewCount={summary.data?.sourceReviewCount ?? null}
        description={data.description}
        isPending={summary.isPending}
      />

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
      />

      {/*
        진열대 화면(A15)과 **같은 등록 모달**입니다. `preselected` 를 넘기면 1단계
        (향수 고르기)를 건너뛰고 분류 · 적합도 · 메모를 적는 2단계로 바로 엽니다 —
        이 화면은 어떤 향수인지 이미 알고 있습니다.

        예전에는 분류만 고르는 모달이었는데, 같은 "진열대에 담기" 인데 들어온 입구에
        따라 적을 수 있는 값이 달라지면 사용자가 둘을 다른 기능으로 읽습니다.
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
      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={toPerfumeDetail(numericId)}
      />
      <Toast {...toastProps} />
    </div>
  )
}
