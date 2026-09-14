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
 * 다섯 개 구역(개요 · 향조 · 계절 · AI 요약 · 후기)을 조립합니다. 마크업은
 * features/perfume/components/ 안에 있습니다.
 * 계절 등록(DTL-16)은 이 화면이 아니라 후기 작성 화면(A24a)에 있습니다.
 *
 * ⚠️ 향조 · 계절 평가 · AI 요약 · 후기 목록은 백엔드에 아직 없어 각 구역이 안내
 * 문구만 보여줍니다.
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)

  const [shelfOpen, setShelfOpen] = useState(false)
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
    /*
      구역마다 종이보다 밝은 판을 깔고 사이를 여백으로 띄웁니다. 예전에는 다섯
      구역이 테두리 상자 하나 안에 가로줄로 나뉘어 있었는데(divide-y), 바탕이
      종이가 되면서 상자 안팎이 같은 색이 되어 구분이 사라졌습니다.
      판 모양은 features/perfume/components/detailSection.ts 에 있습니다.
    */
    <div className="space-y-4">
      <PerfumeOverview
        perfume={data}
        onSaveToShelf={() => setShelfOpen(true)}
      />
      <PerfumeNotes notes={data.notes} />
      <PerfumeSeasonRatings />
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
      <Toast {...toastProps} />
    </div>
  )
}
