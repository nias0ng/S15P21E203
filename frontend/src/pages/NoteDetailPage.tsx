import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'

import { noteDetailQuery, notePerfumesQuery } from '@/features/note'
import { PerfumeGrid } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { parseId } from '@/shared/lib/parseId'
import { readPage, writePage } from '@/shared/lib/queryParams'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Pagination } from '@/shared/ui/Pagination'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/**
 * 노트 상세 (A36 — A35 에서 노트를 누른 화면). 향수는 쪽 넘김입니다 — 인기 노트 하나에
 * 향수가 수만 개 달립니다(머스크 49,571개).
 *
 * NOTE: 브랜드 상세와 달리 [향수 전체 보기] 로 넘기지 못합니다 — 향수 검색 파라미터에
 * `note` 가 없어 노트의 향수는 `/notes/{noteId}/perfumes` 에만 있습니다.
 */
export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const numericId = parseId(noteId)
  const valid = numericId !== null

  const [searchParams, setSearchParams] = useSearchParams()
  const page = readPage(searchParams)

  const note = useQuery({
    ...noteDetailQuery(numericId ?? 0),
    enabled: valid,
  })
  const perfumes = useQuery({
    ...notePerfumesQuery(numericId ?? 0, page),
    enabled: valid,
  })

  if (valid && note.isPending) return <PageFallback />

  if (!valid || note.isError || !note.data) {
    return (
      <EmptyState
        title="노트를 찾을 수 없습니다"
        description="주소를 다시 확인하거나 노트 목록에서 골라 주세요."
        action={
          <div className="flex justify-center gap-2.5">
            {valid && (
              <Button variant="outline" onClick={() => note.refetch()}>
                다시 시도
              </Button>
            )}
            <LinkButton to={ROUTES.NOTES} size="sm">
              노트 목록
            </LinkButton>
          </div>
        }
      />
    )
  }

  const data = note.data

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.NOTES} variant="outline" size="sm">
        ← 노트 목록
      </LinkButton>

      <header className="flex items-center gap-7.5">
        <Thumbnail
          src={data.imageUrl}
          fallback="노트 이미지"
          // NOTE: 바탕을 덮어씁니다 — 그대로 두면 어둠 위에 아이보리 사각형이 남습니다
          className="aspect-7/5 h-60 shrink-0 bg-white/5"
        />

        <div className="space-y-0.5">
          <h1 className="text-ink font-serif text-4xl font-semibold">
            {data.name}
          </h1>
          {data.nameKo && data.nameKo !== data.name && (
            <p className="text-ink-muted text-heading">{data.nameKo}</p>
          )}
        </div>
      </header>

      {data.description && (
        <section className={GLASS_PANEL}>
          <p className="text-ink text-heading leading-relaxed">
            {data.description}
          </p>
        </section>
      )}

      <section className={GLASS_PANEL}>
        <div className="mb-6.25 flex items-baseline gap-2.5">
          <h2 className="text-ink font-serif text-2xl">
            이 노트가 들어간 향수
          </h2>
          {!perfumes.isPending && !!perfumes.data?.totalElements && (
            <span className="text-ink-muted text-caption">
              {perfumes.data.totalElements.toLocaleString('ko-KR')}개
            </span>
          )}
        </div>

        {perfumes.isError ? (
          <EmptyState
            title="향수 목록을 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => perfumes.refetch()}
          />
        ) : (
          <>
            <PerfumeGrid
              items={perfumes.data?.perfumes ?? []}
              isPending={perfumes.isPending}
              columns={5}
              empty={
                <EmptyState
                  title="이 노트를 쓴 향수가 없습니다"
                  description="다른 노트를 골라 보세요."
                />
              }
            />

            {perfumes.data && (
              <Pagination
                className="mt-6.25"
                label="노트별 향수 페이지"
                page={page}
                size={perfumes.data.size}
                totalElements={perfumes.data.totalElements}
                onPageChange={(next) =>
                  setSearchParams(writePage(searchParams, next))
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
