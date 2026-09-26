import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { PerfumePicker } from '@/shared/ui/PerfumePicker'

import type { LinkedPerfume } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  candidates: LinkedPerfume[]
  onSearch: (keyword: string) => void
  onSubmit: (perfumes: LinkedPerfume[]) => void
  single?: boolean
  isPending?: boolean
}

export function LinkedPerfumeModal({
  open,
  onClose,
  candidates,
  onSearch,
  onSubmit,
  single = false,
  isPending = false,
}: Props) {
  const [picked, setPicked] = useState<LinkedPerfume[]>([])

  const toggle = (perfume: LinkedPerfume) => {
    if (single) {
      setPicked([perfume])
      return
    }

    setPicked((prev) =>
      prev.some((item) => item.perfumeId === perfume.perfumeId)
        ? prev.filter((item) => item.perfumeId !== perfume.perfumeId)
        : [...prev, perfume],
    )
  }

  const close = () => {
    setPicked([])
    onClose()
  }

  const isPicked = (perfumeId: number) =>
    picked.some((item) => item.perfumeId === perfumeId)

  return (
    <Modal
      open={open}
      onClose={close}
      title="향수 선택"
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
            선택
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <PerfumePicker
          options={candidates.map((candidate) => ({
            id: candidate.perfumeId,
            name: candidate.name,
            brand: candidate.brand,
            thumbnailUrl: candidate.thumbnailUrl,
          }))}
          isPending={isPending}
          isSelected={isPicked}
          onPick={(option) => {
            const candidate = candidates.find(
              (item) => item.perfumeId === option.id,
            )
            if (candidate) toggle(candidate)
          }}
          onSearch={onSearch}
        />

        <p className="text-ink-muted text-caption">
          {single
            ? (picked[0]?.name ?? '고른 향수가 없습니다')
            : `${picked.length}개 선택됨`}
        </p>
      </div>
    </Modal>
  )
}
