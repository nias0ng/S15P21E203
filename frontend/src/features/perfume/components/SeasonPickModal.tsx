import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { Modal } from '@/shared/ui/Modal'

import { SEASONS, type Season } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  /** 이미 등록한 계절. 여기에 추가하거나 해제합니다 (DTL-24). */
  initial?: Season[]
  onSubmit: (seasons: Season[]) => void
}

/**
 * 계절 등록 모달 (와이어프레임 A11 우측 — DTL-16 · DTL-24)
 *
 * 계절은 여러 개 고를 수 있습니다. 수정은 기존 선택에 추가하거나 해제하는 방식이라
 * 등록과 같은 화면을 씁니다.
 */
export function SeasonPickModal({
  open,
  onClose,
  initial = [],
  onSubmit,
}: Props) {
  const [seasons, setSeasons] = useState<Season[]>(initial)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="잘 어울리는 계절"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => onSubmit(seasons)}>등록</Button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-ink-muted text-caption w-8 shrink-0">계절</span>
        <ChipToggle
          label="잘 어울리는 계절"
          multiple
          options={SEASONS}
          value={seasons}
          onChange={setSeasons}
        />
      </div>
    </Modal>
  )
}
