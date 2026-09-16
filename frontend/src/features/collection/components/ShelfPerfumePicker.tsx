import { useState } from 'react'

import { Checkbox } from '@/shared/ui/Checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { CollectionCandidate } from '../types'

type Props = {
  /** 진열대에 있는 향수만 넘겨주세요 ("진열대에 없는 향수는 추가 불가" — A19 주석) */
  candidates: CollectionCandidate[]
  /** 고른 진열대 항목 번호 */
  picked: number[]
  onToggle: (shelfItemId: number) => void
}

/**
 * 진열대 향수 고르기 목록 — 컬렉션 만들기(A19 좌)와 향수 추가(A19 우)가 같이 씁니다.
 *
 * 검색은 **이 목록 안에서만** 거릅니다. 후보가 이미 내 진열대 전부라 서버에 다시 물을
 * 것이 없습니다. 걸러서 안 보이게 된 향수도 고른 상태는 남습니다 — 검색어를 바꿔 가며
 * 여러 개를 고를 수 있습니다.
 */
export function ShelfPerfumePicker({ candidates, picked, onToggle }: Props) {
  const [keyword, setKeyword] = useState('')

  const needle = keyword.trim().toLowerCase()
  const visible = needle
    ? candidates.filter((candidate) =>
        `${candidate.name} ${candidate.brand ?? ''}`
          .toLowerCase()
          .includes(needle),
      )
    : candidates

  return (
    <div className="space-y-2.5">
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드 검색"
        onSearch={setKeyword}
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="넣을 수 있는 향수가 없습니다"
          description="진열대에 저장한 향수만 컬렉션에 넣을 수 있습니다."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="찾는 향수가 없습니다"
          description="검색어를 바꿔 보세요."
        />
      ) : (
        <ul className="max-h-72.5 space-y-1.25 overflow-y-auto">
          {visible.map((candidate) => (
            <li key={candidate.shelfItemId}>
              <label className="hover:bg-line-soft flex cursor-pointer items-center gap-2.5 p-2.5">
                <Checkbox
                  checked={picked.includes(candidate.shelfItemId)}
                  onChange={() => onToggle(candidate.shelfItemId)}
                />
                {/* 병 사진이라 잘리지 않게 담습니다 */}
                <Thumbnail
                  src={candidate.thumbnailUrl}
                  fit="contain"
                  className="size-10 shrink-0"
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
    </div>
  )
}
