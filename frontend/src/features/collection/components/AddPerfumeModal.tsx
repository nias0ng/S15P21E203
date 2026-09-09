import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type Candidate = {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 고를 수 있는 향수. 와이어프레임 주석대로 진열대에 있는 향수만 넘겨주세요
   * ("진열대에 없는 향수는 추가 불가"). 목록은 화면(pages)에서 진열대 데이터로 만듭니다.
   */
  candidates: Candidate[]
  onSearch: (keyword: string) => void
  onSubmit: (perfumeIds: number[]) => void
}

/**
 * 컬렉션에 향수 추가 모달 (와이어프레임 A19 우 — COL-03)
 *
 * 여러 개를 고를 수 있습니다. 진열대에 없는 향수는 애초에 후보에 들어오지 않습니다.
 */
export function AddPerfumeModal({
  open,
  onClose,
  candidates,
  onSearch,
  onSubmit,
}: Props) {
  const [picked, setPicked] = useState<number[]>([])

  const toggle = (perfumeId: number) => {
    setPicked((prev) =>
      prev.includes(perfumeId)
        ? prev.filter((id) => id !== perfumeId)
        : [...prev, perfumeId],
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
            onClick={() => onSubmit(picked)}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SearchField
          label="향수명 또는 브랜드명으로 검색"
          placeholder="향수명 · 브랜드 검색"
          onSearch={onSearch}
        />

        {candidates.length === 0 ? (
          <EmptyState
            title="추가할 향수가 없습니다"
            description="진열대에 저장한 향수만 컬렉션에 넣을 수 있습니다."
          />
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={candidate.perfumeId}>
                <label className="hover:bg-line-soft flex cursor-pointer items-center gap-3 p-2">
                  <Checkbox
                    checked={picked.includes(candidate.perfumeId)}
                    onChange={() => toggle(candidate.perfumeId)}
                  />
                  <Thumbnail className="size-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="text-ink text-body block truncate font-medium">
                      {candidate.name}
                    </span>
                    <span className="text-ink-muted text-caption block truncate">
                      {candidate.brand}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="text-ink-muted text-caption">
          {picked.length}개 선택됨 · 진열대에 없는 향수는 추가할 수 없습니다.
        </p>
      </div>
    </Modal>
  )
}
