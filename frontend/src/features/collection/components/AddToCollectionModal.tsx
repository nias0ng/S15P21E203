import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import type { CollectionCandidate } from '../types'

import { ShelfPerfumePicker } from './ShelfPerfumePicker'

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 고를 수 있는 향수. 와이어프레임 주석대로 진열대에 있는 향수만 넘겨주세요
   * ("진열대에 없는 향수는 추가 불가"). 목록은 화면(pages)에서 진열대 데이터로 만듭니다.
   * 이미 이 컬렉션에 담긴 향수는 빼고 넘깁니다 — 넣어 봐야 409 입니다.
   */
  candidates: CollectionCandidate[]
  /** 고른 진열대 항목 번호들 */
  onSubmit: (shelfItemIds: number[]) => void
  isSubmitting?: boolean
}

/**
 * 컬렉션에 향수 추가 모달 (와이어프레임 A19 우 — COL-03)
 *
 * 여러 개를 고를 수 있습니다. 진열대에 없는 향수는 애초에 후보에 들어오지 않습니다.
 *
 * 앱에 "향수를 고르는 모달" 이 셋이라 이름에 목적지를 넣었습니다 —
 * 여기(컬렉션), `ShelfRegisterModal` 1단계(진열대), `LinkedPerfumeModal`(글).
 * 셋 다 향수를 고르지만 고른 뒤에 벌어지는 일이 전혀 다릅니다.
 *
 * 고른 상태는 모달이 들고 있습니다. 열 때마다 비우려면 화면이 `key` 를 바꿔 새로 그립니다.
 */
export function AddToCollectionModal({
  open,
  onClose,
  candidates,
  onSubmit,
  isSubmitting = false,
}: Props) {
  const [picked, setPicked] = useState<number[]>([])

  const toggle = (shelfItemId: number) => {
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="향수 추가"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={picked.length === 0}
            isLoading={isSubmitting}
            onClick={() => onSubmit(picked)}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <ShelfPerfumePicker
          candidates={candidates}
          picked={picked}
          onToggle={toggle}
        />

        <p className="text-ink-muted text-caption">
          {picked.length}개 선택됨 · 진열대에 없는 향수는 추가할 수 없습니다.
        </p>
      </div>
    </Modal>
  )
}
