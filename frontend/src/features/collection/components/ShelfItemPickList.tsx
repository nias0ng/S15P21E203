import { useMemo } from 'react'

import { cn } from '@/shared/lib/cn'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SearchField } from '@/shared/ui/SearchField'
import { Thumbnail } from '@/shared/ui/Thumbnail'

/** 컬렉션은 향수가 아니라 진열대 항목을 담습니다 — `perfumeId` 로는 지울 수 없습니다 */
export type ShelfItemCandidate = {
  shelfItemId: number
  perfumeId: number
  name: string
  /** 브랜드가 비어 있는 향수가 있습니다 */
  brand: string | null
  thumbnailUrl?: string | null
}

type Props = {
  candidates: ShelfItemCandidate[]
  picked: number[]
  onToggle: (shelfItemId: number) => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  /** 후보가 하나도 없을 때 할 말. 만들 때와 담을 때가 다릅니다 */
  emptyTitle: string
}

/**
 * 진열대에서 향수를 골라 담는 목록 (A19 — COL-01 · COL-03). 검색은 서버에 묻지 않고 받아
 * 둔 후보 안에서 거릅니다 — 목록 API 에 검색어가 없습니다.
 */
export function ShelfItemPickList({
  candidates,
  picked,
  onToggle,
  keyword,
  onKeywordChange,
  emptyTitle,
}: Props) {
  const visible = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    if (!needle) return candidates

    return candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(needle) ||
        (candidate.brand?.toLowerCase().includes(needle) ?? false),
    )
  }, [candidates, keyword])

  return (
    <>
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드 검색"
        value={keyword}
        onChange={(event) => onKeywordChange(event.target.value)}
        onSearch={onKeywordChange}
      />

      {/* 담을 향수가 없는 것과 검색어에 안 걸린 것은 다음에 할 일이 달라 문구를 나눕니다 */}
      {candidates.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description="진열대에 저장한 향수만 컬렉션에 넣을 수 있습니다."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="조건에 맞는 향수가 없습니다"
          description="다른 향수명이나 브랜드명으로 검색해 보세요."
        />
      ) : (
        /* 체크박스 대신 카드 자체가 누르는 자리입니다 — 고른 것은 `aria-pressed` 로 알립니다 */
        <ul className="grid max-h-90 grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-4">
          {visible.map((candidate) => {
            const isPicked = picked.includes(candidate.shelfItemId)

            return (
              <li key={candidate.shelfItemId}>
                <button
                  type="button"
                  aria-pressed={isPicked}
                  onClick={() => onToggle(candidate.shelfItemId)}
                  className={cn(
                    'w-full border p-2.5 text-left',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    isPicked
                      ? 'border-accent bg-line-soft'
                      : 'border-line hover:border-accent',
                  )}
                >
                  <Thumbnail
                    src={candidate.thumbnailUrl}
                    fallback="이미지"
                    className="text-caption mb-2.5 aspect-3/4 w-full"
                  />
                  <span className="text-ink text-body block truncate font-medium">
                    {candidate.name}
                  </span>
                  <span className="text-ink-muted text-caption block truncate">
                    {candidate.brand}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* 검색으로 가려진 향수도 고른 채로 셉니다 */}
      <p className="text-ink-muted text-caption">
        {picked.length}개 선택됨 · 진열대에 없는 향수는 추가할 수 없습니다.
      </p>
    </>
  )
}
