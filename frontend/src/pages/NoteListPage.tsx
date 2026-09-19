import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import {
  filterByFamily,
  NoteCategorySections,
  noteFamiliesQuery,
  noteListQuery,
} from '@/features/note'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { PillFilter } from '@/shared/ui/PillFilter'
import { SearchField, SEARCH_FIELD_LIST_WIDTH } from '@/shared/ui/SearchField'

/**
 * 노트 (와이어프레임 A35 — 상단 메뉴 [노트] 목적지)
 *
 * 와이어프레임 주석:
 * - 대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 — 대분류 순서는 고정
 * - 노트를 누르면 노트 상세(A36)
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md (판이 대분류마다 한 장씩입니다) *
 * 검색어와 대분류를 URL 쿼리에 둡니다. 새로고침 · 뒤로가기 · 링크 공유가 같은
 * 결과를 보여주게 하려는 것입니다.
 */
export default function NoteListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const family = searchParams.get('family')

  const { data, isPending } = useQuery(noteListQuery(keyword))
  const { data: families } = useQuery(noteFamiliesQuery)

  /*
    검색어는 `noteListQuery` 의 select 가 이미 걸렀습니다. 대분류는 여기서 겹쳐
    겁니다 — 둘 다 캐시된 같은 목록 위에서 하는 일이라 요청이 늘지 않습니다.
  */
  const shown = filterByFamily(data ?? [], family)
  const hasFilter = keyword !== '' || family !== null

  const setParam = (key: 'keyword' | 'family', value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="space-y-3.75">
      <h1 className="sr-only">노트</h1>

      {/*
        헤더에 검색창이 없고 검색은 각 페이지 안에 있다는 와이어프레임 규칙.
        향수 목록 · 브랜드와 **같은 폭 · 같은 자리**에 둡니다 — 상단 메뉴로 세 화면을
        오갈 때 검색창이 움직이면 같은 자리를 여러 번 겨냥하게 됩니다.
      */}
      <SearchField
        className={cn(SEARCH_FIELD_LIST_WIDTH, 'mx-auto w-full')}
        label="노트명으로 검색"
        placeholder="노트명으로 검색해주세요."
        defaultValue={keyword}
        key={keyword}
        onSearch={(next) => setParam('keyword', next.trim() || null)}
      />

      {/*
        대분류 알약. 브랜드의 정렬 알약과 달리 `required` 가 아닙니다 — 켜진 것을
        다시 누르면 꺼지고 전체로 돌아갑니다. 정렬은 꺼지면 줄 세울 기준이 없지만
        이건 "거르지 않음" 이 멀쩡한 상태입니다.

        목록이 오기 전에는 그리지 않습니다. 빈 묶음을 미리 두면 낭독기가 아무것도
        없는 필터를 읽습니다.
      */}
      {families && families.length > 0 && (
        <PillFilter
          label="노트 대분류"
          options={families.map((value) => ({ value, label: value }))}
          value={family}
          onChange={(next) => setParam('family', next)}
          className="flex-wrap justify-center"
        />
      )}

      <NoteCategorySections
        notes={shown}
        isPending={isPending}
        emptyAction={
          hasFilter && (
            <Button variant="outline" onClick={() => setSearchParams({})}>
              초기화
            </Button>
          )
        }
      />
    </div>
  )
}
