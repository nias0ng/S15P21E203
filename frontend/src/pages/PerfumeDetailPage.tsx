import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import {
  perfumeDetailQuery,
  SeasonPickModal,
  SeasonRatingChart,
  ShelfSaveModal,
  type SeasonRating,
} from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/**
 * 향수 상세 (와이어프레임 A10 — DTL-01 · 02 · 03 · 10 · 12 · 15)
 *
 * 다섯 개 구역으로 나뉩니다.
 *   ① 기본 정보 + 액션   ② 향조   ③ 계절별 평가   ④ AI 후기 요약   ⑤ 후기
 *
 * ⚠️ 백엔드 GET /perfumes/{id} 가 아직 없어 호출하면 404 입니다. 화면 골격만
 * 만들어 둔 상태이고, 계절 평가 · AI 요약 · 후기 목록은 응답에 아직 없는 필드라
 * 백엔드가 붙으면 연결해야 합니다.
 */
/**
 * ⚠️ 계절별 평가(DTL-14)가 백엔드 응답에 아직 없습니다. 와이어프레임을 눈으로
 * 확인할 수 있도록 그 화면의 수치를 그대로 넣어두었습니다.
 * API 가 준비되면 이 상수를 지우고 응답 값을 넘겨주세요.
 */
const PLACEHOLDER_SEASON_RATINGS: SeasonRating[] = [
  { season: 'SPRING', percentage: 40 },
  { season: 'SUMMER', percentage: 12 },
  { season: 'AUTUMN', percentage: 38 },
  { season: 'WINTER', percentage: 10 },
]

export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const numericId = Number(perfumeId)

  const [shelfOpen, setShelfOpen] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { data, isPending, isError, error } = useQuery({
    ...perfumeDetailQuery(numericId),
    enabled: Number.isFinite(numericId),
  })

  if (isPending) return <PageFallback />
  if (isError) {
    return (
      <EmptyState
        title="향수 정보를 불러오지 못했습니다"
        description={error.message}
      />
    )
  }

  return (
    <div className="divide-line border-line divide-y border">
      {/* ① 기본 정보 + 액션 */}
      <section className="flex flex-col gap-6 p-6 sm:flex-row">
        {data.thumbnailUrl ? (
          <img
            src={data.thumbnailUrl}
            alt=""
            className="border-line bg-surface-sunken h-72 w-60 shrink-0 border object-cover"
          />
        ) : (
          <div className="border-line bg-surface-sunken text-ink-muted flex h-72 w-60 shrink-0 items-center justify-center border text-[10.5px]">
            대표 이미지
          </div>
        )}

        <div className="space-y-3">
          <p className="text-ink-muted text-xs">{data.brand}</p>
          <h1 className="text-2xl font-bold">{data.name}</h1>

          {/* ⚠️ scentFamily 는 백엔드가 아직 안 내려줍니다 */}
          {data.scentFamily && (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="outline">{data.scentFamily}</Badge>
            </div>
          )}

          <div>
            <Button onClick={() => setShelfOpen(true)}>진열대에 저장</Button>
            <p className="text-ink-muted mt-2 text-[10.5px]">
              진열대 저장은 분류 선택이 필수입니다.
            </p>
          </div>
        </div>
      </section>

      {/* ② 향조 */}
      <section className="space-y-3 p-6">
        <h2 className="text-ink-muted text-[10.5px]">향조</h2>
        {(
          [
            ['탑 노트', data.notes.top],
            ['미들 노트', data.notes.middle],
            ['베이스 노트', data.notes.base],
          ] as const
        ).map(([label, notes]) => (
          <div key={label} className="flex items-center gap-4">
            <span className="text-ink w-20 shrink-0 text-xs">{label}</span>
            <div className="flex flex-wrap gap-1.5">
              {notes.map((note) => (
                <Badge key={note} tone="outline">
                  {note}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ③ 계절별 평가 — 계절마다 도넛 하나 */}
      <section className="space-y-4 p-6">
        <h2 className="text-ink text-sm font-bold">계절별 평가</h2>
        {/* TODO: 백엔드 DTL-14 응답 연결. 아래는 와이어프레임 수치 자리표시자입니다. */}
        <SeasonRatingChart ratings={PLACEHOLDER_SEASON_RATINGS} />
        <Button variant="outline" size="sm" onClick={() => setSeasonOpen(true)}>
          계절 등록
        </Button>
      </section>

      {/* ④ AI 후기 요약 — 브랜드 설명과 2열 */}
      <section className="grid gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-ink text-sm font-bold">AI 후기 요약</h2>
          {/* TODO: 백엔드 DTL-23 응답 연결 */}
          <p className="text-ink-muted text-xs leading-relaxed">
            후기가 충분히 쌓이면 요약을 보여드립니다.
          </p>
          <p className="text-ink-muted text-[10.5px] leading-relaxed">
            후기를 AI가 요약해 문장으로 보여줍니다. 퍼센트는 문장 안의 수치로만
            쓰고 막대는 쓰지 않습니다. 호평 · 혹평을 섞어 4문장까지 보여주고,
            후기 수가 적으면 요약을 생성하지 않습니다.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-ink text-sm font-bold">브랜드 공식 향 설명</h2>
          <p className="text-ink text-xs leading-relaxed">{data.description}</p>
        </div>
      </section>

      {/* ⑤ 후기 */}
      <section className="space-y-3 p-6">
        <LinkButton to={ROUTES.REVIEW_WRITE}>후기 쓰기</LinkButton>
        <p className="text-ink-muted text-[10.5px]">
          [후기 쓰기]는 모달이 아니라 후기 게시글 작성 화면으로 이동합니다. 이
          향수가 대상으로 걸린 채 열립니다.
        </p>

        {/* TODO: 백엔드 DTL-03 후기 목록 연결 */}
        <EmptyState
          title="아직 후기가 없습니다"
          description="이 향수를 시향했다면 첫 후기를 남겨보세요."
        />
      </section>

      <ShelfSaveModal
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        onSave={() => {
          // TODO: SHF-01 저장 API 연결
          setShelfOpen(false)
          setToast('진열대에 저장했습니다')
        }}
      />
      <SeasonPickModal
        open={seasonOpen}
        onClose={() => setSeasonOpen(false)}
        onSubmit={() => {
          // TODO: DTL-16 계절 등록 API 연결
          setSeasonOpen(false)
          setToast('계절을 등록했습니다')
        }}
      />
      <Toast
        open={toast !== null}
        onClose={() => setToast(null)}
        message={toast ?? ''}
      />
    </div>
  )
}
