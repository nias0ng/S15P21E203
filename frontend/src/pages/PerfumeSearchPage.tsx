import { useSearchParams } from 'react-router'

import { PerfumeSearchResult } from '@/features/perfume'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 향수 검색 결과 (와이어프레임 A09 — COM-05)
 *
 * 검색어는 URL 쿼리(`?keyword=`)에 둡니다. 그래야 새로고침·뒤로가기·링크 공유가
 * 모두 같은 결과를 보여줍니다.
 */
export default function PerfumeSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''

  return (
    <div className="space-y-3.5">
      <h1 className="sr-only">향수 검색 결과</h1>

      <SearchField
        label="향수명 또는 브랜드명으로 검색"
        placeholder="향수명 또는 브랜드명으로 검색합니다"
        defaultValue={keyword}
        // key 를 주어 URL 이 바뀌면 입력값도 따라오게 합니다
        key={keyword}
        onSearch={(next) => {
          const trimmed = next.trim()
          setSearchParams(trimmed ? { keyword: trimmed } : {})
        }}
      />

      <PerfumeSearchResult keyword={keyword} />
    </div>
  )
}
