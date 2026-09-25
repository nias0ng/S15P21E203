import { ChipToggle } from '@/shared/ui/ChipToggle'
import { StarRating } from '@/shared/ui/StarRating'
import { Textarea } from '@/shared/ui/Textarea'

import { SHELF_CATEGORIES, type ShelfCategory } from '../types'

type Props = {
  category: ShelfCategory | null
  onCategoryChange: (next: ShelfCategory | null) => void
  rating: number | null
  /** `null` 은 해제입니다 — 서버에서는 `DELETE .../fit-rating` 이 됩니다 */
  onRatingChange: (next: number | null) => void
  memo: string
  onMemoChange: (next: string) => void
  /**
   * 비운 채로 저장하려 했을 때 분류 칸 옆에 [필수] 를 띄웁니다.
   *
   * 무엇이 필수인지는 여기서 정하지 않고 **부르는 쪽이 정합니다.** 담을 때(A15)는
   * 분류를 골라야 하는데 고칠 때(A13)는 비울 수 있어서, 칸만 보고는 지금 빈 것이
   * 잘못인지 알 수 없습니다.
   *
   * 적합도와 메모에는 이 표시가 없습니다 — 세 자리 중 필수는 분류뿐입니다.
   */
  categoryMissing?: boolean
  /** 아래 안내 문구. 할 말이 없는 자리에서는 넘기지 않습니다 */
  hint?: string
  /**
   * 좁은 판(3D 향 지도 위 — `ShelfRegisterModal` 의 `scene`)의 짜임. 분류 칩 셋이 한 줄을
   * 나눠 채우고 메모 칸이 세 줄로 줄어듭니다 — 칩이 왼쪽에 몰리면 오른쪽이 비고, 빈 메모
   * 칸이 판의 절반을 차지해 여백만 크게 읽힙니다.
   */
  compact?: boolean
}

/**
 * 진열대 항목 한 개를 이루는 값 — 분류 · 취향 적합도 · 메모.
 *
 * 세 곳이 같은 세 칸을 씁니다. 등록 모달 2단계(A15), 진열대 카드의 [변경하기],
 * 향수 상세의 [진열대에 저장]. 따로 적어 두면 한 곳에만 칸이 늘거나 라벨이
 * 달라져서, 같은 값을 화면마다 다른 이름으로 부르게 됩니다.
 *
 * 값을 들고 있지 않습니다(controlled) — 담는 것과 고치는 것은 저장하는 방법이
 * 달라서(POST 셋 · PATCH 셋) 그 판단은 부르는 쪽에 둡니다. 필수 여부도 같은
 * 이유로 밖에 있습니다.
 *
 * **적합도는 [해제] 로 지웁니다.** `StarRating` 이 라디오 그룹이라 한 번 매기면
 * 다른 점수로만 바꿀 수 있어서, 지우는 길을 따로 둡니다. 매기지 않았을 때는
 * 지울 것이 없으므로 단추도 없습니다.
 */
export function ShelfItemFields({
  category,
  onCategoryChange,
  rating,
  onRatingChange,
  memo,
  onMemoChange,
  categoryMissing = false,
  hint,
  compact = false,
}: Props) {
  return (
    <>
      {/* [필수] 가 마지막 칩 오른쪽에 서도록 한 줄로 묶습니다 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <ChipToggle
          label="진열대 분류"
          options={SHELF_CATEGORIES}
          value={category}
          onChange={onCategoryChange}
          className={compact ? 'grid flex-1 grid-cols-3' : undefined}
        />
        {categoryMissing && <RequiredMark what="진열대 분류를 골라 주세요" />}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-ink-muted text-caption">내 취향 적합도</span>
        <StarRating
          label="내 취향 적합도"
          value={rating}
          /*
           * 아직 안 매겼을 때의 "아직 매기지 않음" 은 **글자로 띄우지 않습니다.**
           * 빈 원 다섯 개가 이미 같은 말을 하고 있습니다.
           *
           * `showValue` 를 끄는 것은 지우는 것이 아니라 `sr-only` 로 미는 것이라
           * 낭독기에는 그대로 읽힙니다 — 원은 `aria-hidden` 이어서 이 글자가
           * 값을 전하는 유일한 통로입니다. 매긴 뒤에는 "4.5 / 5" 로 다시 보입니다.
           * 반개 차이는 원만 봐서는 헷갈립니다.
           */
          showValue={rating !== null}
          onChange={onRatingChange}
        />
        {rating !== null && (
          <button
            type="button"
            onClick={() => onRatingChange(null)}
            className="text-ink-muted hover:text-ink text-caption underline underline-offset-2"
          >
            해제
          </button>
        )}
      </div>

      <Textarea
        label="메모"
        hideLabel
        placeholder="메모"
        rows={compact ? 3 : 5}
        value={memo}
        onChange={(event) => onMemoChange(event.target.value)}
      />

      {hint && (
        <p className="text-ink-muted text-caption leading-relaxed">{hint}</p>
      )}
    </>
  )
}

/**
 * 빈 칸 옆에 붙는 [필수].
 *
 * **저장을 누른 뒤에만 나타납니다.** 열자마자 빨간 글자 둘이 떠 있으면 아직
 * 아무것도 안 했는데 이미 틀린 것처럼 보입니다.
 *
 * 눈에는 두 글자지만 낭독기에는 어느 칸 이야기인지까지 읽힙니다. `role="alert"` 은
 * 나타나는 순간 읽어 달라는 표시입니다. 포커스는 방금 누른 단추에 그대로 있습니다.
 */
function RequiredMark({ what }: { what: string }) {
  return (
    <span role="alert" className="text-danger text-caption font-medium">
      필수<span className="sr-only"> — {what}</span>
    </span>
  )
}
