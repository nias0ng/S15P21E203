import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Modal } from '@/shared/ui/Modal'

import { SHELF_CATEGORIES, type ShelfCategory } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (category: ShelfCategory) => void
  /**
   * 이미 진열대에 있는 향수의 분류를 바꿀 때 현재 분류를 넘깁니다.
   * 넘기면 제목과 버튼이 "분류 변경"이 되고 그 분류가 미리 선택된 채로 열립니다.
   * 넘기지 않으면 새로 저장하는 모달입니다.
   */
  initialCategory?: ShelfCategory | null
}

/**
 * 진열대에 저장 · 분류 변경 모달 (와이어프레임 A11 좌측 · A13 [분류 변경] — SHF-01 · SHF-03)
 *
 * 분류 변경도 같은 구성이라 모달을 재사용합니다(C02). 차이는 제목 · 버튼 문구와
 * 초깃값뿐입니다. 분류는 필수라 고르기 전에는 버튼이 꺼져 있습니다.
 */
export function ShelfSaveModal({
  open,
  onClose,
  onSave,
  initialCategory = null,
}: Props) {
  const [category, setCategory] = useState<ShelfCategory | null>(
    initialCategory,
  )
  const changing = initialCategory !== null

  // 열릴 때마다 초깃값으로 되돌립니다. Modal 이 <dialog> 라 닫아도 언마운트되지 않아
  // 그냥 두면 지난번 선택이 남습니다. useEffect 가 아니라 렌더 중에 조정하는 이유:
  // 그려진 뒤 바꾸면 옛 값으로 한 번 깜빡이고 cascading renders 규칙에도 걸립니다.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setCategory(initialCategory)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={changing ? '분류 변경' : '진열대에 저장'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={category === null}
            onClick={() => category && onSave(category)}
          >
            {changing ? '변경' : '저장'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-ink-muted text-caption">
          {changing ? '옮길 분류를 선택하세요' : '분류를 선택하세요'}
        </p>
        <ChipToggle
          label="진열대 분류"
          options={SHELF_CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <p className="text-ink-muted text-caption leading-relaxed">
          분류는 필수입니다. 선택하지 않으면{' '}
          {changing ? '변경되지' : '저장되지'} 않습니다.
        </p>
      </div>
    </Modal>
  )
}
