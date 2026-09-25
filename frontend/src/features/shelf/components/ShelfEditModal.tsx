import { useState } from 'react'

import { useResetOnOpen } from '@/shared/hooks/useResetOnOpen'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import type { ShelfCategory, ShelfItemDetail } from '../types'

import { ShelfItemFields } from './ShelfItemFields'

/** [변경하기] 에서 제출하는 값. 안 바뀐 것까지 그대로 담아 보냅니다 */
export interface ShelfEditInput {
  category: ShelfCategory
  rating: number | null
  memo: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** 고칠 항목. 열 때의 값으로 칸을 채웁니다 */
  item: ShelfItemDetail | null
  /**
   * `item` 이 서버에서 받은 **진짜 상세**인지. 목록 값으로 임시로 채운 것이면 false.
   *
   * 없으면 지워집니다 — 상세가 오기 전에 열면 적합도 · 메모가 빈 채로 칸에 박히고,
   * 그대로 [변경] 하면 화면은 "안 건드렸다" 고 여기는데 서버에는 값이 있어
   * **지우는 요청이 나갑니다.** 진짜 값이 도착하면 칸을 다시 잡습니다.
   */
  ready: boolean
  onSave: (input: ShelfEditInput) => void
}

/**
 * 진열대 항목 변경 (와이어프레임 A13 카드의 [변경하기] — C02)
 *
 * 예전에는 분류만 고치는 모달이었습니다. 그런데 카드에서 고칠 수
 * 있는 값은 분류 · 적합도 · 메모 셋인데 단추는 "분류 변경" 하나뿐이라, 적합도와
 * 메모는 고칠 입구가 없었습니다. 셋을 한 자리에 모으고 단추 이름도 [변경하기] 로
 * 바꿨습니다 — 등록할 때 채우는 칸과 같은 셋이라 사용자가 배울 것이 늘지 않습니다.
 *
 * 대상 향수는 여기서 바꿀 수 없습니다. 서버에 옮기는 경로가 없고, 한 사람이 같은
 * 향수를 두 번 담을 수도 없습니다 — 다른 향수로 옮기려면 빼고 다시 담습니다.
 */
export function ShelfEditModal({ open, onClose, item, ready, onSave }: Props) {
  /*
   * 열릴 때의 값으로 칸을 되돌립니다. Modal 이 <dialog> 라 닫아도 언마운트되지
   * 않아서, 이렇게 하지 않으면 다른 향수를 열었을 때 앞 향수의 메모가 남습니다.
   */
  const [category, setCategory] = useState<ShelfCategory | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  // 상세가 도착하면(ready) key 가 바뀌어 칸을 진짜 값으로 다시 잡습니다
  const key = open ? `${item?.shelfItemId ?? 'none'}:${ready}` : null
  useResetOnOpen(key, () => {
    setCategory(item?.category ?? null)
    setRating(item?.rating ?? null)
    setMemo(item?.memo ?? '')
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="변경하기"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            /*
              분류는 비울 수 없습니다 — 향수는 반드시 어느 칸엔가 섭니다.
              상세를 아직 못 받았으면 지금 칸에 든 값이 진짜가 아니라 저장도 막습니다.
            */
            disabled={category === null || !ready}
            onClick={() =>
              category &&
              onSave({ category, rating, memo: memo.trim() || null })
            }
          >
            변경
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        {item && (
          <div className="flex items-center gap-2.5">
            <span className="text-ink text-body font-medium">{item.name}</span>
            <span className="text-ink-muted text-caption">{item.brand}</span>
          </div>
        )}

        <ShelfItemFields
          category={category}
          onCategoryChange={setCategory}
          rating={rating}
          onRatingChange={setRating}
          memo={memo}
          onMemoChange={setMemo}
          hint="메모와 적합도는 비울 수 있습니다."
        />
      </div>
    </Modal>
  )
}
