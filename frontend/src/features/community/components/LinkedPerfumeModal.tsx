import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { SearchField } from '@/shared/ui/SearchField'

import type { LinkedPerfume } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  /** 검색 결과. 화면(pages)에서 향수 도메인 데이터를 넘겨주세요. */
  candidates: LinkedPerfume[]
  onSearch: (keyword: string) => void
  onSubmit: (perfumes: LinkedPerfume[]) => void
}

/**
 * 글에 연결할 향수 선택 모달 (와이어프레임 C02 — A24b 의 관련 향수 선택)
 *
 * 이름이 커뮤니티의 `LinkedPerfume` 을 따라가는 이유: 향수 도메인을 가리키면 향수
 * 검색 모달과 헷갈립니다. 여러 개 고를 수 있습니다.
 *
 * 후보 목록은 화면에서 넘겨받습니다 — features 끼리는 import 할 수 없습니다.
 */
export function LinkedPerfumeModal({
  open,
  onClose,
  candidates,
  onSearch,
  onSubmit,
}: Props) {
  const [picked, setPicked] = useState<LinkedPerfume[]>([])

  const toggle = (perfume: LinkedPerfume) => {
    setPicked((prev) =>
      prev.some((item) => item.perfumeId === perfume.perfumeId)
        ? prev.filter((item) => item.perfumeId !== perfume.perfumeId)
        : [...prev, perfume],
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="향수 선택"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => onSubmit(picked)}
          >
            선택
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <SearchField
          label="향수명 또는 브랜드명으로 검색"
          placeholder="향수명 · 브랜드 검색"
          onSearch={onSearch}
        />

        {candidates.length === 0 ? (
          <EmptyState
            title="향수를 찾지 못했습니다"
            description="검색어를 입력해 향수를 찾아보세요."
          />
        ) : (
          <ul className="max-h-72.5 space-y-1.25 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={candidate.perfumeId}>
                <label className="hover:bg-line-soft flex cursor-pointer items-center gap-2.5 p-2.5">
                  <Checkbox
                    checked={picked.some(
                      (item) => item.perfumeId === candidate.perfumeId,
                    )}
                    onChange={() => toggle(candidate)}
                  />
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

        <p className="text-ink-muted text-caption">{picked.length}개 선택됨</p>
      </div>
    </Modal>
  )
}
