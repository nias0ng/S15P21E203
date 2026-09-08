import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import {
  perfumeDetailQuery,
  PerfumeNotes,
  PerfumeOverview,
  PerfumeReviewList,
  PerfumeReviewSummary,
  PerfumeSeasonRatings,
  SeasonPickModal,
} from '@/features/perfume'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import { ShelfSaveModal } from '@/features/shelf'
import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/**
 * 향수 상세 (와이어프레임 A10 — DTL-01 · 02 · 03 · 10 · 12 · 15)
 *
 * 다섯 개 구역을 조립합니다. 각 구역의 마크업과 자리표시자는
 * features/perfume/components/ 안에 있습니다.
 *   ① PerfumeOverview  ② PerfumeNotes  ③ PerfumeSeasonRatings
 *   ④ PerfumeReviewSummary  ⑤ PerfumeReviewList
 *
 * ⚠️ 백엔드 GET /perfumes/{id} 가 아직 없어 호출하면 404 입니다. 계절 평가 ·
 * AI 요약 · 후기 목록도 응답에 없는 필드라, 각 구역 컴포넌트의 주석을 보세요.
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)

  const [shelfOpen, setShelfOpen] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  const { data, isPending, isError, refetch } = useQuery({
    ...perfumeDetailQuery(numericId),
    enabled: Number.isFinite(numericId),
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
    <div className="divide-line border-line divide-y border">
      <PerfumeOverview
        perfume={data}
        onSaveToShelf={() => setShelfOpen(true)}
      />
      <PerfumeNotes notes={data.notes} />
      <PerfumeSeasonRatings onRegisterSeason={() => setSeasonOpen(true)} />
      <PerfumeReviewSummary description={data.description} />
      <PerfumeReviewList />

      <ShelfSaveModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        onSave={() => {
          // TODO: SHF-01 저장 API 연결
          setShelfOpen(false)
          showToast('진열대에 저장했습니다')
        }}
      />
      <SeasonPickModal
        open={seasonOpen}
        onClose={() => setSeasonOpen(false)}
        onSubmit={() => {
          // TODO: DTL-16 계절 등록 API 연결
          setSeasonOpen(false)
          showToast('계절을 등록했습니다')
        }}
      />
      <Toast {...toastProps} />
    </div>
  )
}
