import { useMemo } from 'react'

import { toNoteDetail } from '@/shared/config/routes'
import { CARD_GRID } from '@/shared/ui/cardGrid'
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
  emptyAction?: React.ReactNode
}

/**
 * 대분류별 노트 섹션 (A35). 고정 목록을 두지 않고 받은 순서를 끊습니다 — 대분류는 열린
 * 문자열이라, 목록을 들고 있으면 새 값이 생긴 날 그 노트들이 조용히 사라집니다.
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
            <div className={CARD_GRID}>
              {/* 카드와 같은 비율이어야 도착할 때 격자가 안 튑니다(7:5) */}
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="border-line rounded-card flex flex-col gap-2.5 border p-2.5"
                >
                  <Skeleton className="rounded-image aspect-7/5 w-full" />
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

          <ul className={CARD_GRID}>
            {section.notes.map((note) => (
              <li key={note.noteId}>
                <TileCard
                  to={toNoteDetail(note.noteId)}
                  media={
                    <Thumbnail
                      src={note.imageUrl}
                      fallback="이미지"
                      /* 7:5 로 올라옵니다. 높이를 고정하면 좌우가 잘립니다 */
                      className="rounded-image aspect-7/5 w-full"
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
