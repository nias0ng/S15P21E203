import { useMemo } from 'react'

import { toNoteDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import { groupByAccordFamily } from '../grouping'
import type { Note } from '../types'

type Props = {
  notes: Note[]
  isPending?: boolean
  /** 0건 안내 아래 버튼. 검색어·대분류로 걸러 0건이 된 경우 [초기화] 를 답니다. */
  emptyAction?: React.ReactNode
}

/**
 * 대분류별 노트 섹션 (와이어프레임 A35)
 *
 * 와이어프레임 주석: "대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 —
 * 대분류 순서는 고정".
 *
 * **대분류마다 유리판 한 장입니다.** 향수·브랜드는 격자 하나를 판 한 장에 얹지만,
 * 노트는 묶음이 여럿이라 한 판에 다 넣으면 판이 화면보다 길어져 "떠 있는 판" 으로
 * 안 읽힙니다. 판을 끊으면 그 사이로 어두운 방이 보여 층이 살아납니다.
 *
 * **고정 목록을 두지 않고 받은 순서를 끊습니다.** 대분류는 백엔드가 원본 파일의
 * 코드를 그대로 내보내는 열린 문자열이라, 화면이 목록을 들고 있으면 새 값이 생긴
 * 날 그 노트들이 조용히 사라집니다(목록에 없는 대분류는 어느 섹션에도 안 걸립니다).
 * 응답이 이미 대분류 순 · 인기 순으로 오므로 대분류가 바뀌는 자리에서 끊으면
 * 순서도 고정이고 새 값도 제 자리에 그려집니다. 묶는 규칙은 `../grouping` 에 있습니다.
 */
export function NoteCategorySections({
  notes,
  isPending = false,
  emptyAction,
}: Props) {
  const sections = useMemo(() => groupByAccordFamily(notes), [notes])

  if (isPending) {
    return (
      <div className="space-y-7.5">
        {Array.from({ length: 2 }, (_, section) => (
          <div key={section} className={GLASS_PANEL}>
            <Skeleton className="mb-6.25 h-6 w-23.75" />
            <div className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
              {/* 카드와 같은 비율이어야 도착할 때 격자가 안 튑니다(7:5) */}
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="border-line rounded-card flex flex-col gap-2.5 border p-2.5"
                >
                  <Skeleton className="aspect-7/5 w-full" />
                  {/* 영문 이름 · 한국어 이름 두 줄 */}
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <EmptyState
        title="노트를 찾지 못했습니다"
        description="다른 이름으로 검색해보세요."
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-7.5">
      {sections.map((section) => (
        <section key={section.family} className={GLASS_PANEL}>
          <div className="mb-6.25 flex items-baseline gap-2.5">
            <h2 className="text-ink font-serif text-2xl">{section.family}</h2>
            <span className="text-ink-muted text-caption">
              {section.notes.length}개
            </span>
          </div>

          <ul className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
            {section.notes.map((note) => (
              <li key={note.noteId}>
                <TileCard
                  to={toNoteDetail(note.noteId)}
                  media={
                    <Thumbnail
                      src={note.imageUrl}
                      fallback="이미지"
                      /* 7:5 로 올라옵니다. 높이를 고정하면 좌우가 잘립니다 */
                      className="aspect-7/5 w-full"
                    />
                  }
                  /* 두 값이 같으면 같은 글자가 두 줄로 겹치지 않게 뺍니다 */
                  title={note.name}
                  caption={note.nameKo !== note.name ? note.nameKo : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
