import { toNoteDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import { NOTE_CATEGORIES, type Note } from '../types'

type Props = {
  notes: Note[]
  isPending?: boolean
  /** 0건 안내 아래 버튼. 검색어로 걸러 0건이 된 경우 [초기화] 를 답니다. */
  emptyAction?: React.ReactNode
}

/**
 * 대분류별 노트 섹션 (와이어프레임 A35)
 *
 * 와이어프레임 주석: "대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 —
 * 대분류 순서는 고정". 그래서 데이터에 나오는 순서나 알파벳 순이 아니라
 * NOTE_CATEGORIES 배열 순서를 그대로 따릅니다. 해당 노트가 하나도 없는 대분류는
 * 섹션 자체를 그리지 않습니다.
 */
export function NoteCategorySections({
  notes,
  isPending = false,
  emptyAction,
}: Props) {
  if (isPending) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }, (_, section) => (
          <div key={section} className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-32" />
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
        description="노트명을 다시 확인해 주세요."
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-8">
      {NOTE_CATEGORIES.map((category) => {
        const items = notes.filter((note) => note.category === category)
        if (items.length === 0) return null

        return (
          <section key={category} className="space-y-3">
            <h2 className="text-ink text-title font-serif font-semibold">
              {category}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((note) => (
                <li key={note.noteId}>
                  <TileCard
                    to={toNoteDetail(note.noteId)}
                    media={
                      <Thumbnail
                        src={note.imageUrl}
                        fallback="이미지"
                        className="h-20 w-full"
                      />
                    }
                    title={note.name}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
