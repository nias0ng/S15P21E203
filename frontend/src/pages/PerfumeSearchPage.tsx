import { useNavigate, useSearchParams } from 'react-router'

import { PerfumeSearchResult } from '@/features/perfume'
import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 향수 검색 결과 (A09 — COM-05). 검색어와 쪽 번호를 URL 쿼리에 두고,
 * **URL 의 page 는 1부터**라 백엔드(0부터)와 여기서 한 번 바꿉니다.
 */
export default function PerfumeSearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const page = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">향수 검색 결과</h1>

      <SearchField
        // 향수 목록과 같은 폭 · 같은 자리 — 두 화면을 오갈 때 검색창이 안 움직여야 합니다
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 · 브랜드로 검색해주세요."
        defaultValue={keyword}
        // key 를 주어 URL 이 바뀌면 입력값도 따라오게 합니다
        key={keyword}
        onSearch={(next) => {
          const trimmed = next.trim()
          // 새로 검색하면 첫 쪽부터 봅니다 — 3쪽에 있던 자리는 의미가 없습니다
          setSearchParams(trimmed ? { keyword: trimmed } : {})
        }}
      />

      <PerfumeSearchResult
        keyword={keyword}
        page={page}
        onPageChange={(next) => {
          const params = new URLSearchParams(searchParams)
          params.set('page', String(next + 1))
          setSearchParams(params)
        }}
        // 찾는 것이 없으면 검색어만 지우는 게 아니라 향수 목록으로 돌려보냅니다
        onBrowseAll={() => navigate(ROUTES.PERFUMES)}
      />
    </div>
  )
}
