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
import { Button } from '@/shared/ui/Button'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 향수 (와이어프레임 A33 — 상단 메뉴 [향수] 목적지)
 *
 * 와이어프레임 주석:
 * - 아무 필터도 고르지 않은 상태가 기본 — 전체 향수를 보여준다
 * - 카드를 누르면 향수 상세(A10) · 스크롤하면 이어서 로드
 *
 * 필터를 고르기 전에는 "최근 인기 향수" 라는 제목으로 전체를 깔아 둡니다.
 * 첫 화면이 빈 상태로 시작하면 무엇을 하는 화면인지 알 수 없기 때문입니다.
 *
 * 조건을 하나도 보내지 않으면 백엔드가 활성 향수 전체를 돌려줍니다.
 *
 * 위 줄 필터(shelf)는 **전체 사용자 집계** 기준입니다. 내 진열대가 아니라
 * 많은 사람이 진열대에 담은 순으로 좁힙니다. 로그인이 필요 없습니다.
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

  const items = data?.perfumes ?? []

  // 검색어·필터로 걸러 0건이 됐을 때만 [초기화] 를 보여줍니다.
  // 원래 데이터가 없는 경우에는 초기화해도 달라지지 않으니 버튼을 걸지 않습니다.
  const hasFilter = shelf !== null || gender !== null || brand !== null

  const resetFilters = () => {
    setShelf(null)
    setGender(null)
    const next = new URLSearchParams(searchParams)
    next.delete('brand')
    setSearchParams(next)
  }

  return (
    <div className="space-y-3.5">
      <h1 className="sr-only">향수</h1>

      {/*
        헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙.

        폭을 본문의 절반으로 묶습니다. 꽉 채우면 한 줄짜리 입력창이 카드 다섯 장
        만큼 넓어져서, 화면에서 가장 먼저 눈에 들어오는 것이 향수가 아니라 빈 칸이
        됩니다. 검색은 이 화면의 주인공이 아닙니다.
      */}
      <SearchField
        className="max-w-lg"
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색해주세요."
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

      {/*
        구분선을 뺐습니다. 종이 바탕으로 오면서 필터 판과 카드가 각자 경계를
        갖게 되어, 그 사이 가로줄은 종이를 두 장으로 잘라 보이게 합니다.
        구분은 선이 아니라 여백(pt-4)이 합니다.
      */}
      <section className="space-y-3 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-ink text-title font-serif font-semibold">
            {hasFilter ? '조건에 맞는 향수' : '최근 인기 향수'}
          </h2>
          {items.length > 0 && (
            <span className="text-ink-muted text-caption">
              {items.length}개
            </span>
          )}
        </div>

        <PerfumeGrid
          items={items}
          isPending={isPending}
          columns={5}
          // 번호는 조건 없는 "최근 인기 향수" 에서만 답니다. 걸러낸 목록의 1번은
          // 인기 1위가 아니라 그냥 첫 줄이라 오해를 만듭니다.
          numbered={!hasFilter}
          emptyAction={
            hasFilter && (
              <Button variant="outline" onClick={resetFilters}>
                초기화
              </Button>
            )
          }
        />
      </section>
    </div>
  )
}
