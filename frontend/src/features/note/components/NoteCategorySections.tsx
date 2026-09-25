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
                      className="rounded-image aspect-7/5 w-full"
                    />
                  }
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
