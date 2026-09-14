import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { noteDetailQuery } from '@/features/note'
import { PerfumeGrid } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 노트 상세 (와이어프레임 A36 — A35 에서 노트를 누른 화면)
 *
 * ⚠️ "이 노트가 들어간 향수" 는 백엔드 엔드포인트가 없어 빈 배열입니다.
 * API 가 생기면 useQuery 결과를 items 에 넘겨주세요.
 */
export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const numericId = Number(noteId)

  const { data, isPending, isError, refetch } = useQuery({
    ...noteDetailQuery(numericId),
    enabled: Number.isFinite(numericId),
  })

  if (isPending) return <PageFallback />
  if (isError || !data) {
    return (
      <EmptyState
        title="노트 상세 정보를 불러오지 못했습니다"
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
    <div className="space-y-6">
      <LinkButton to={ROUTES.NOTES} variant="outline" size="sm">
        ← 뒤로 가기
      </LinkButton>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Thumbnail
          src={data.imageUrl}
          fallback="노트 이미지"
          className="h-40 w-56 shrink-0"
        />

        <div className="flex-1 space-y-2">
          <div className="border-line rounded-card flex items-center gap-3 border px-3 py-3">
            <span className="text-ink-muted text-caption">대분류</span>
            <span className="text-ink text-body font-medium">
              {data.category}
            </span>
            <span className="text-ink-muted text-caption">· {data.name}</span>
          </div>

          <div className="border-line rounded-card space-y-2 border p-3">
            <p className="text-ink-muted text-caption">설명</p>
            <p className="text-ink text-body">{data.description}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        {/*
          ⚠️ 개수(data.perfumeCount)는 자리표시자가 늘 42 를 돌려줍니다. 목록도 아직
          없어서 "42" 라고 써 두면 진짜 데이터로 읽힙니다. 노트별 향수 API 가 붙으면
          그때 개수를 답니다.
        */}
        <h2 className="text-ink text-title font-serif font-semibold">
          이 노트가 들어간 향수
        </h2>
        {/* TODO: 노트별 향수 목록 API 연결 (스크롤로 이어 로드도 함께) */}
        <PerfumeGrid
          items={[]}
          columns={5}
          empty={
            <EmptyState
              title="향수 목록을 준비 중입니다"
              description="노트별 향수 조회 API 가 붙으면 표시됩니다."
            />
          }
        />
      </section>
    </div>
  )
}
