import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Modal } from '@/shared/ui/Modal'

import { SHELF_CATEGORIES, type ShelfCategory } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (category: ShelfCategory) => void
}

/**
 * 진열대에 저장 모달 (와이어프레임 A11 좌측 — SHF-01)
 *
 * 와이어프레임 주석: "분류는 필수. 선택하지 않으면 저장하지 않는다 —
 * 보유 중 · 시향해 봄 · 보유 희망 셋 중 하나". 그래서 고르기 전에는 [저장]이 꺼져 있습니다.
 */
export function ShelfSaveModal({ open, onClose, onSave }: Props) {
  const [category, setCategory] = useState<ShelfCategory | null>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="진열대에 저장"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={category === null}
            onClick={() => category && onSave(category)}
          >
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-ink-muted text-[10.5px]">분류를 선택하세요</p>
        <ChipToggle
          label="진열대 분류"
          options={SHELF_CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <p className="text-ink-muted text-[10.5px] leading-relaxed">
          분류는 필수입니다. 선택하지 않으면 저장되지 않습니다.
        </p>
      </div>
    </Modal>
  )
}
