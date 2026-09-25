import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import { noteDetailQuery, notePerfumesQuery } from '@/features/note'
import { PerfumeGrid } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
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
  const numericId = Number(noteId)
  const valid = Number.isFinite(numericId)

  const [page, setPage] = useState(0)

  /*
    노트를 옮겨 다니면 쪽 번호가 남아, 3쪽을 보다가 향수가 20개뿐인 노트로 들어가면 빈
    격자가 나옵니다. 렌더 중에 맞추는 것은 `useEffect` 로 한 박자 늦게 되돌리면 첫
    프레임에 그 빈 격자가 보여서입니다.
  */
  const [pagedNoteId, setPagedNoteId] = useState(numericId)
  if (pagedNoteId !== numericId) {
    setPagedNoteId(numericId)
    setPage(0)
  }

  const note = useQuery({ ...noteDetailQuery(numericId), enabled: valid })
  const perfumes = useQuery({
    ...notePerfumesQuery(numericId, page),
    enabled: valid,
  })

  if (valid && note.isPending) return <PageFallback />

  // 없는 noteId 와 불러오기 실패를 같은 안내로 묶습니다 — 할 일이 같습니다
  if (!valid || note.isError || !note.data) {
    return (
      <EmptyState
        title="노트를 찾을 수 없습니다"
        description="주소를 다시 확인하거나 노트 목록에서 골라 주세요."
        action={
          <div className="flex justify-center gap-2.5">
            <Button variant="outline" onClick={() => note.refetch()}>
              다시 시도
            </Button>
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

        {/*
          대분류(`accordFamily`)는 여기 적지 않습니다 — 목록이 이미 대분류로 묶어 보여
          주므로 방금 지나온 제목을 한 번 더 읽히는 줄이 됩니다.
        */}
        <div className="space-y-0.5">
          <h1 className="text-ink font-serif text-4xl font-semibold">
            {data.name}
          </h1>
          {/* 영문과 철자가 같은 노트는 빼서 같은 글자가 두 줄로 겹치지 않게 합니다 */}
          {data.nameKo && data.nameKo !== data.name && (
            <p className="text-ink-muted text-heading">{data.nameKo}</p>
          )}
        </div>
      </header>

      {/*
        설명은 채워지는 대로 들어와 없는 노트가 있습니다. 없으면 판째로 그리지
        않습니다 — 빈 판을 두면 "아직 안 불러온 것" 처럼 보입니다.
      */}
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

            {/* 응답 전에 `size` 가 0 이면 쪽 수 계산이 NaN 이 되어 한 프레임 깨집니다 */}
            {perfumes.data && (
              <Pagination
                className="mt-6.25"
                label="노트별 향수 페이지"
                page={page}
                size={perfumes.data.size}
                totalElements={perfumes.data.totalElements}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
