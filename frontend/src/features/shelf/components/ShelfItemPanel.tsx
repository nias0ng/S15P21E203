import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { StarRating } from '@/shared/ui/StarRating'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { SHELF_CATEGORIES, type ShelfItem } from '../types'

type Props = {
  item: ShelfItem | null
  onSetRepresentative: () => void
  onUnsave: () => void
  onChangeCategory: () => void
  onEditMemo: () => void
}

/**
 * 선택한 향수 카드 (와이어프레임 A13 우측 패널)
 *
 * 진열대에서 병을 누르면 여기에 뜹니다.
 * 메모는 향수 한 개당 하나이고 등록 모달(A15)에서 쓰고 여기서 수정합니다.
 */
export function ShelfItemPanel({
  item,
  onSetRepresentative,
  onUnsave,
  onChangeCategory,
  onEditMemo,
}: Props) {
  if (!item) {
    return (
      <aside className="border-line text-ink-muted text-caption flex min-h-72 items-center justify-center border p-4 text-center">
        진열대에서 향수를 선택하면
        <br />
        여기에 정보가 표시됩니다
      </aside>
    )
  }

  const categoryLabel = SHELF_CATEGORIES.find(
    (category) => category.value === item.category,
  )?.label

  return (
    <aside className="border-line space-y-3 border p-4">
      <p className="text-ink-muted text-caption">향수 카드</p>

      <div className="flex gap-3">
        <Thumbnail src={item.thumbnailUrl} className="size-20 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-ink text-body truncate font-medium">{item.name}</p>
          <p className="text-ink-muted text-caption truncate">{item.brand}</p>
          <Badge tone="outline">{categoryLabel}</Badge>
        </div>
      </div>

      {item.rating !== null && (
        <div className="flex items-center gap-2">
          <span className="text-ink-muted text-caption">적합도</span>
          <StarRating label="내 취향 적합도" value={item.rating} />
        </div>
      )}

      <div className="space-y-2">
        <Button
          variant="outline"
          fullWidth
          disabled={item.representative}
          onClick={onSetRepresentative}
        >
          {item.representative ? '대표 향수입니다' : '대표 향수로 지정'}
        </Button>
        <Button variant="outline" fullWidth onClick={onUnsave}>
          저장 해제
        </Button>
        <Button variant="outline" fullWidth onClick={onChangeCategory}>
          분류 변경
        </Button>
      </div>

      <hr className="border-line" />

      <div className="flex items-center gap-2">
        <span className="text-ink-muted text-caption">메모</span>
        {item.memoUpdatedAt && (
          <span className="text-ink-muted text-caption">
            {item.memoUpdatedAt.slice(0, 10).replaceAll('-', '.')}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={onEditMemo}
        >
          수정
        </Button>
      </div>
      <p className="border-line text-ink text-body rounded-card min-h-16 border p-3">
        {item.memo ?? '남긴 메모가 없습니다.'}
      </p>
    </aside>
  )
}
