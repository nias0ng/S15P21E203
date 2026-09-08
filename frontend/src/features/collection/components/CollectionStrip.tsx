import { Link } from 'react-router'

import { toCollectionDetail } from '@/shared/config/routes'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { CollectionSummary } from '../types'

type Props = {
  items: CollectionSummary[]
  isPending?: boolean
  /** 마지막 자리를 눌렀을 때 — 컬렉션 만들기(A19)로 갑니다 */
  onCreate: () => void
}

/**
 * 내 컬렉션 목록 (와이어프레임 A13 하단)
 *
 * 와이어프레임 주석:
 * - 진열대와 컬렉션이 한 페이지 — 컬렉션 목록 화면도, 진열대 하위 탭도 없다
 * - 마지막 컬렉션 다음 자리가 항상 플러스 자리 — 여기서 컬렉션 만들기(A19)로 간다
 * - 컬렉션 카드를 누르면 A17
 */
export function CollectionStrip({ items, isPending = false, onCreate }: Props) {
  const gridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {items.map((collection) => (
        <Link
          key={collection.collectionId}
          to={toCollectionDetail(collection.collectionId)}
          className="border-line bg-surface-card hover:border-slate space-y-2 border p-3 transition-shadow hover:shadow-md"
        >
          <span className="flex gap-1.5">
            {collection.previewThumbnails
              .slice(0, 3)
              .map((thumbnail, index) => (
                <Thumbnail
                  key={index}
                  src={thumbnail}
                  className="h-14 flex-1"
                />
              ))}
          </span>
          <span className="text-ink block truncate text-xs font-bold">
            {collection.title}
          </span>
          <span className="text-ink-muted block text-[10.5px]">
            향수 {collection.perfumeCount}개
          </span>
        </Link>
      ))}

      <button
        type="button"
        onClick={onCreate}
        className="border-line text-ink-muted hover:bg-line-soft hover:text-ink flex min-h-40 flex-col items-center justify-center gap-1 border border-dashed transition-colors"
      >
        <span aria-hidden className="text-lg">
          +
        </span>
        <span className="text-[10.5px]">새 컬렉션</span>
      </button>
    </div>
  )
}
