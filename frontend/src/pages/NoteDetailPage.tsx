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
 * 노트 상세 (와이어프레임 A36 — A35 에서 노트를 누른 화면)
 *
 * 향수 목록(A33) · 브랜드(A34) · 노트 목록(A35) · 향수 상세(A10)와 같은 **어두운 방 +
 * 유리판** 구성입니다. 어둠은 라우트의 `handle.night`(app/router)이 켭니다.
 *
 * 향수는 **쪽 넘김**입니다. 와이어프레임의 "스크롤로 이어 로드" 와 다르지만, 인기
 * 노트 하나에 향수가 수만 개 달려(머스크 49,571개) 이어 붙이면 끝이 없습니다.
 *
 * ⚠️ **브랜드 상세처럼 [향수 전체 보기]로 넘기지 못합니다.** 향수 검색 파라미터에
 * `note` 가 없어(features/perfume/types.ts 의 `PerfumeSearchParams`) 노트의 향수는
 * `/notes/{noteId}/perfumes` 에만 있습니다. 필터가 생기면 그때 같이 맞춥니다.
 */
export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const numericId = Number(noteId)
  const valid = Number.isFinite(numericId)

  const [page, setPage] = useState(0)

  /*
    노트를 옮겨 다니면(A36 → A35 → A36) 쪽 번호가 남아, 3쪽을 보다가 향수가 20개뿐인
    노트로 들어가면 빈 격자가 나옵니다. 렌더 중에 맞추는 이유는 `useEffect` 로 한 박자
    늦게 되돌리면 첫 프레임에 그 빈 격자가 보여서입니다.
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
          /*
            ⚠️ **바탕을 여기서 덮어씁니다.** `Thumbnail` 의 기본 상자는
            `bg-surface-sunken` 인데 `.scent-night` 는 이 토큰을 다시 정의하지
            않습니다(유리판 **안쪽**에서만 뒤집힙니다). 그대로 두면 사진이 없거나
            아직 안 받아졌을 때 어둠 위에 아이보리 사각형이 남습니다.
          */
          className="aspect-7/5 h-60 shrink-0 bg-white/5"
        />

        <div className="space-y-2.5">
          <div className="space-y-0.5">
            <h1 className="text-ink font-serif text-4xl font-semibold">
              {data.name}
            </h1>
            {/*
              한국어 이름이 없는 노트가 있습니다. 영문과 철자가 같은 노트도 빼서
              같은 글자가 두 줄로 겹치지 않게 합니다.
            */}
            {data.nameKo && data.nameKo !== data.name && (
              <p className="text-ink-muted text-heading">{data.nameKo}</p>
            )}
          </div>

          <p className="text-ink-muted text-caption">
            대분류 {data.accordFamily ?? '기타'}
          </p>
        </div>
      </header>

      {/*
        설명 판. `notes.description` 은 컬럼이 NULL 을 허용하고 채워지는 대로
        들어옵니다(V21 마이그레이션). 없으면 판째로 그리지 않습니다 — 빈 판을 두면
        "아직 안 불러온 것" 처럼 보입니다.
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
          {/* 자릿수 구분은 인기 노트가 다섯 자리여서입니다(머스크 49,571) */}
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
            action={
              <Button variant="outline" onClick={() => perfumes.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : (
          <>
            {/* 백엔드 기본값인 20개가 옵니다(api.ts 가 `size` 를 안 보냅니다) */}
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

            {/*
              응답이 오기 전에는 그리지 않습니다. `size` 를 0 으로 넘기면 쪽 수
              계산이 NaN 이 되어 쪽 번호가 깨진 채로 한 프레임 보입니다.
            */}
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
