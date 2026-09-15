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
 * 와이어프레임 주석:
 * - 노트 하나에 대분류 · 설명 · 그 노트가 들어간 향수 목록
 * - 향수 카드를 누르면 향수 상세(A10) · 향수가 많으면 스크롤로 이어 로드
 *
 * ⚠️ "이 노트가 들어간 향수" 목록은 백엔드 엔드포인트가 없습니다. 향수 도메인의
 * PerfumeGrid 를 그대로 쓰되 지금은 빈 배열이라 안내 문구가 나옵니다.
 * 노트별 향수 API 가 생기면 useQuery 결과를 items 에 넘겨주세요.
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
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.NOTES} variant="outline" size="sm">
        ← 뒤로 가기
      </LinkButton>

      <div className="flex flex-col gap-3.75 sm:flex-row">
        <Thumbnail
          src={data.imageUrl}
          fallback="노트 이미지"
          className="h-40 w-56.25 shrink-0"
        />

        <div className="flex-1 space-y-2.5">
          <div className="border-line flex items-center gap-2.5 border px-2.5 py-2.5">
            <span className="text-ink-muted text-[10.5px]">대분류</span>
            <span className="text-ink text-xs font-bold">{data.category}</span>
            <span className="text-ink-muted text-[10.5px]">· {data.name}</span>
          </div>

          <div className="border-line space-y-2.5 border p-2.5">
            <p className="text-ink-muted text-[10.5px]">설명</p>
            <p className="text-ink text-xs leading-relaxed">
              {data.description}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-ink text-sm font-bold">
          이 노트가 들어간 향수 {data.perfumeCount}
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
