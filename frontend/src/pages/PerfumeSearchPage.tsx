import { useSearchParams } from 'react-router'

import { PerfumeSearchResult } from '@/features/perfume'
import { cn } from '@/shared/lib/cn'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 향수 검색 결과 (와이어프레임 A09 — COM-05)
 *
 * 검색어와 쪽 번호를 URL 쿼리에 둡니다. 그래야 새로고침·뒤로가기·링크 공유가
 * 모두 같은 결과를 보여줍니다. **URL 의 page 는 1부터**이고 백엔드는 0부터라
 * 여기서 한 번 바꿉니다 — 주소창에 `page=0` 이 보이면 사람이 읽기 어렵습니다.
 */
export default function PerfumeSearchPage() {
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
        onResetKeyword={() => setSearchParams({})}
      />
    </div>
  )
}
