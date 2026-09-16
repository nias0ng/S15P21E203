import { ChipToggle } from '@/shared/ui/ChipToggle'
import { StarRating } from '@/shared/ui/StarRating'
import { Textarea } from '@/shared/ui/Textarea'

import { SHELF_CATEGORIES, type ShelfCategory } from '../types'

type Props = {
  category: ShelfCategory | null
  onCategoryChange: (next: ShelfCategory | null) => void
  rating: number | null
  onRatingChange: (next: number) => void
  memo: string
  onMemoChange: (next: string) => void
  /** 아래 안내 문구. 담을 때와 고칠 때 할 말이 다릅니다 */
  hint: string
}

/**
 * 진열대 항목 한 개를 이루는 값 — 분류 · 취향 적합도 · 메모.
 *
 * 세 곳이 같은 세 칸을 씁니다. 등록 모달 2단계(A15), 진열대 카드의 [변경하기],
 * 향수 상세의 [진열대에 저장]. 따로 적어 두면 한 곳에만 칸이 늘거나 라벨이
 * 달라져서, 같은 값을 화면마다 다른 이름으로 부르게 됩니다.
 *
 * 값을 들고 있지 않습니다(controlled) — 담는 것과 고치는 것은 저장하는 방법이
 * 달라서(POST 셋 · PATCH 셋) 그 판단은 부르는 쪽에 둡니다.
 *
 * **적합도를 지우는 길은 없습니다.** `StarRating` 이 라디오 그룹이라 한 번 매기면
 * 다른 점수로만 바꿀 수 있습니다. 서버에는 `DELETE .../fit-rating` 이 있으니
 * 해제 UI 를 붙이기로 하면 그때 이어집니다.
 */
export function ShelfItemFields({
  category,
  onCategoryChange,
  rating,
  onRatingChange,
  memo,
  onMemoChange,
  hint,
}: Props) {
  return (
    <>
      <ChipToggle
        label="진열대 분류"
        options={SHELF_CATEGORIES}
        value={category}
        onChange={onCategoryChange}
      />

      <div className="flex items-center gap-2.5">
        <span className="text-ink-muted text-caption">내 취향 적합도</span>
        <StarRating
          label="내 취향 적합도"
          value={rating}
          onChange={onRatingChange}
        />
      </div>

      <Textarea
        label="메모"
        hideLabel
        placeholder="메모"
        rows={5}
        value={memo}
        onChange={(event) => onMemoChange(event.target.value)}
      />

      <p className="text-ink-muted text-caption leading-relaxed">{hint}</p>
    </>
  )
}
