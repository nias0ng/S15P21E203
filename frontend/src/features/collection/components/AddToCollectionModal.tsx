import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import { ShelfItemPickList, type ShelfItemCandidate } from './ShelfItemPickList'

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 고를 수 있는 향수. 와이어프레임 주석대로 진열대에 있는 향수만 넘겨주세요
   * ("진열대에 없는 향수는 추가 불가"). 목록은 화면(pages)에서 진열대 데이터로 만듭니다.
   */
  candidates: ShelfItemCandidate[]
  onSearch: (keyword: string) => void
  /** **진열대 항목 번호**입니다 — 서버가 `shelfItemIds` 로 받습니다 */
  onSubmit: (shelfItemIds: number[]) => void
}

/**
 * 컬렉션에 향수 추가 모달 (와이어프레임 A19 우 — COL-03)
 *
 * 여러 개를 고를 수 있습니다. 진열대에 없는 향수는 애초에 후보에 들어오지 않습니다.
 *
 * 앱에 "향수를 고르는 모달" 이 셋이라 이름에 목적지를 넣었습니다 —
 * 여기(컬렉션), `ShelfRegisterModal` 1단계(진열대), `LinkedPerfumeModal`(글).
 * 셋 다 향수를 고르지만 고른 뒤에 벌어지는 일이 전혀 다릅니다.
 */
export function AddToCollectionModal({
  open,
  onClose,
  candidates,
  onSearch,
  onSubmit,
}: Props) {
  const [picked, setPicked] = useState<number[]>([])

  const toggle = (shelfItemId: number) =>
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )

  const close = () => {
    setPicked([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="향수 추가"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => {
              onSubmit(picked)
              setPicked([])
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <ShelfItemPickList
          candidates={candidates}
          picked={picked}
          onToggle={toggle}
          onSearch={onSearch}
          emptyTitle="추가할 향수가 없습니다"
        />
      </div>
    </Modal>
  )
}
