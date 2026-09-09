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
 * 이름이 커뮤니티 도메인의 `LinkedPerfume` 을 따라갑니다. 향수 도메인의 향수 고르기가
 * 아니라 **글에 연결된 향수**를 고르는 자리라서, 이름이 향수 도메인을 가리키면
 * 향수 검색 모달과 헷갈립니다.
 *
 * 와이어프레임 C02 는 선택 모달 3종이지만 실제로 필요한 건 이것뿐입니다.
 * - 내 향 이미지 선택: 향 이미지 기능(X01 · X02)을 만들지 않기로 해서 제외
 * - 분류 변경: 진열대(A13)의 모달이라 진열대 도메인에 있습니다
 *
 * 와이어프레임 주석에 "A24b는 여러 개 · X01는 한 개만" 이라고 적혀 있고
 * X01 이 빠졌으므로 여러 개 선택으로 만들었습니다.
 *
 * 향수 데이터는 향수 도메인에 있는데 features 끼리는 import 할 수 없으므로
 * 후보 목록은 화면에서 넘겨받습니다.
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
      <div className="space-y-3">
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
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={candidate.perfumeId}>
                <label className="hover:bg-line-soft flex cursor-pointer items-center gap-3 p-2">
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
