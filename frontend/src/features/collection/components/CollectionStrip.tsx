import { toCollectionDetail } from '@/shared/config/routes'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

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
  /*
    한 줄에 셋. **카드 폭은 넷이던 때 그대로 두고**(1920 에서 440) 남는 폭은 카드 사이
    간격과 좌우 여백으로 돌립니다 — 셋으로 줄이면서 폭까지 다 나눠 가지면 카드와 사진만
    커져서 빽빽한 느낌이 그대로 남습니다. 440 x 3 + 가로 간격 40 x 2 = 1400.

    가로 간격만 넓힙니다(`gap-x-10`). 세로는 줄과 줄 사이라 카드 제목이 위 카드 사진에서
    멀어질 이유가 없어 15 그대로 둡니다.
  */
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
              {collection.previewThumbnails
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
        className="border-line text-ink-muted hover:bg-line-soft hover:text-ink rounded-card flex min-h-40 flex-col items-center justify-center gap-1.25 border border-dashed transition-colors duration-120 ease-out"
      >
        <span aria-hidden className="text-title">
          +
        </span>
        <span className="text-caption">새 컬렉션</span>
      </button>
    </div>
  )
}
