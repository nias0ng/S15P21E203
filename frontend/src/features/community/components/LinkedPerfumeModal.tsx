import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { PerfumePicker } from '@/shared/ui/PerfumePicker'

import type { LinkedPerfume } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  /** 검색 결과. 화면(pages)에서 향수 도메인 데이터를 넘겨주세요. */
  candidates: LinkedPerfume[]
  onSearch: (keyword: string) => void
  onSubmit: (perfumes: LinkedPerfume[]) => void
  /** 하나만 고르게 합니다(후기는 향수 한 개에 씁니다) */
  single?: boolean
  /** 검색 결과를 기다리는 중 */
  isPending?: boolean
}

/**
 * 글에 연결할 향수 선택 모달 (C02 — A24b 의 관련 향수 선택)
 *
 * 후보 목록은 화면에서 넘겨받습니다 — features 끼리는 import 할 수 없습니다.
 */
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

  /*
    `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않습니다. 비우지 않으면 다음에
    열었을 때 지난번에 고른 향수가 그대로 남습니다.
  */
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
