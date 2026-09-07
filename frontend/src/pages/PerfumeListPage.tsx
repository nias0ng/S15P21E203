import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import {
  perfumeListQuery,
  PerfumeFilters,
  PerfumeGrid,
  type GenderFilter,
  type ShelfFilter,
} from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 향수 (와이어프레임 A33 — 상단 메뉴 [향수] 목적지)
 *
 * 와이어프레임 주석:
 * - 아무 필터도 고르지 않은 상태가 기본 — 전체 향수를 보여준다
 * - 카드를 누르면 향수 상세(A10) · 스크롤하면 이어서 로드
 *
 * TODO: 스크롤 이어서 로드(무한 스크롤). 백엔드 페이지네이션은 이미 준비돼 있어
 * useInfiniteQuery 로 바꾸면 됩니다. 지금은 첫 페이지만 불러옵니다.
 */
export default function PerfumeListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [shelf, setShelf] = useState<ShelfFilter | null>(null)
  const [gender, setGender] = useState<GenderFilter | null>(null)

  // A34 브랜드 페이지에서 카드를 누르면 ?brand= 를 달고 옵니다
  const brand = searchParams.get('brand')

  const { data, isPending } = useQuery(
    perfumeListQuery({
      shelf: shelf ?? undefined,
      gender: gender ?? undefined,
      brand: brand ?? undefined,
    }),
  )

  return (
    <div className="space-y-3.5">
      <h1 className="sr-only">향수</h1>

      {/* 헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙 */}
      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색"
        onSearch={(keyword) => {
          const trimmed = keyword.trim()
          if (!trimmed) return
          // 검색을 누르면 검색 결과 화면(A09)으로 넘깁니다
          navigate(
            `${ROUTES.PERFUME_SEARCH}?keyword=${encodeURIComponent(trimmed)}`,
          )
        }}
      />

      {brand && (
        <div className="flex items-center gap-2">
          <span className="border-line text-ink flex items-center gap-2 border px-3 py-1.5 text-[11px]">
            브랜드: {brand}
            <button
              type="button"
              aria-label={`브랜드 필터 ${brand} 해제`}
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('brand')
                setSearchParams(next)
              }}
              className="text-ink-muted hover:text-ink"
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        </div>
      )}

      <PerfumeFilters
        shelf={shelf}
        gender={gender}
        onShelfChange={setShelf}
        onGenderChange={setGender}
      />

      <hr className="border-line" />

      <PerfumeGrid
        items={data?.content ?? []}
        isPending={isPending}
        columns={5}
      />
    </div>
  )
}
