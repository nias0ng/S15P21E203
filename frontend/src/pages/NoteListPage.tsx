import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import { NoteCategorySections, noteListQuery } from '@/features/note'
import { SearchField } from '@/shared/ui/SearchField'

/**
 * 노트 (와이어프레임 A35 — 상단 메뉴 [노트] 목적지)
 *
 * 와이어프레임 주석:
 * - 대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 — 대분류 순서는 고정
 * - 노트를 누르면 노트 상세(A36)
 */
export default function NoteListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''

  const { data, isPending } = useQuery(noteListQuery(keyword))

  return (
    <div className="space-y-6">
      <h1 className="sr-only">노트</h1>

      <SearchField
        label="노트명으로 검색"
        placeholder="노트명으로 검색"
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => {
          const trimmed = next.trim()
          setSearchParams(trimmed ? { keyword: trimmed } : {})
        }}
      />

      <NoteCategorySections notes={data ?? []} isPending={isPending} />
    </div>
  )
}
