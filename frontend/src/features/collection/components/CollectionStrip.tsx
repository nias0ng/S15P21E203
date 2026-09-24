import { toCollectionDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { FOCUS_RING } from '@/shared/ui/focusRing'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import type { CollectionSummary } from '../types'

type Props = {
  items: CollectionSummary[]
  isPending?: boolean
  onCreate: () => void
}

/** 내 컬렉션 목록 (A13 하단). 진열대와 한 페이지라 별도 목록 화면도 하위 탭도 없습니다 */
export function CollectionStrip({ items, isPending = false, onCreate }: Props) {
  /* 한 줄에 셋. 440 x 3 + 가로 간격 40 x 2 = 1400 */
  const gridClass =
    'mx-auto grid w-full max-w-350 grid-cols-2 gap-x-10 gap-y-3.75 sm:grid-cols-3'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {items.map((collection) => (
        <TileCard
          key={collection.collectionId}
          to={toCollectionDetail(collection.collectionId)}
          media={
            <span className="flex gap-2.5">
              {/* 목록은 사진이 셋보다 적을 수 있어 빈 자리로 채웁니다 — 모자라면 카드가 납작해집니다 */}
              {[...collection.previewThumbnails, null, null, null]
                .slice(0, 3)
                .map((thumbnail, index) => (
                  <Thumbnail
                    key={index}
                    src={thumbnail}
                    className="aspect-3/4 min-w-0 flex-1"
                  />
                ))}
            </span>
          }
          title={collection.title}
          caption={`향수 ${collection.perfumeCount}개`}
        />
      ))}

      <button
        type="button"
        onClick={onCreate}
        className={cn(
          'border-line text-ink-muted hover:bg-line-soft hover:text-ink rounded-card flex min-h-40 flex-col items-center justify-center gap-1.25 border border-dashed transition-colors duration-120 ease-out',
          FOCUS_RING,
        )}
      >
        <span aria-hidden className="text-title">
          +
        </span>
        <span className="text-caption">새 컬렉션</span>
      </button>
    </div>
  )
}
