import { queryOptions } from '@tanstack/react-query'

import { getNote, getNotePerfumes, getNotes } from './api'
import { noteFamilies } from './grouping'
import type { Note } from './types'

export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (noteId: number) => [...noteKeys.details(), noteId] as const,
  perfumes: (noteId: number, page: number) =>
    [...noteKeys.detail(noteId), 'perfumes', page] as const,
}

/**
 * 노트 카탈로그는 자주 바뀌지 않습니다. 246개가 한 번에 오는 응답이라 화면을
 * 오갈 때마다 다시 받지 않도록 기본값(1분)보다 길게 둡니다. 브랜드와 같은 값입니다.
 */
const CATALOG_STALE_TIME = 1000 * 60 * 10

/**
 * 검색어는 **캐시 키에 넣지 않습니다.**
 *
 * 서버에 검색어 파라미터가 없어 어차피 같은 응답 하나를 받습니다. 키에 넣으면
 * 글자를 칠 때마다 다른 키가 되어 같은 246개를 몇 번이고 다시 받습니다.
 * 받아 둔 목록에 `select` 로 거르면 요청은 한 번이고 거르는 일만 다시 합니다.
 */
export const noteListQuery = (keyword: string) =>
  queryOptions({
    queryKey: noteKeys.lists(),
    queryFn: getNotes,
    staleTime: CATALOG_STALE_TIME,
    select: (notes: Note[]) => filterNotes(notes, keyword),
  })

/** 영문 · 한국어 이름을 함께 봅니다. 한국어 이름이 없는 노트가 있습니다 */
function filterNotes(notes: Note[], keyword: string): Note[] {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return notes

  return notes.filter(
    (note) =>
      note.name.toLowerCase().includes(needle) ||
      (note.nameKo?.toLowerCase().includes(needle) ?? false),
  )
}

/**
 * 알약 필터에 쓸 대분류 목록.
 *
 * 목록과 **같은 캐시를 봅니다**(같은 `queryKey`, 거르는 방식만 다른 `select`) —
 * 요청이 한 번 더 가지 않습니다.
 *
 * **검색 결과가 아니라 전체 노트에서 뽑습니다.** 검색어에 걸린 것만으로 만들면
 * 글자를 칠 때마다 알약이 사라졌다 나타나 줄 수가 오르내리고, 그 바람에 아래
 * 유리판이 위아래로 밀립니다.
 */
export const noteFamiliesQuery = queryOptions({
  queryKey: noteKeys.lists(),
  queryFn: getNotes,
  staleTime: CATALOG_STALE_TIME,
  select: noteFamilies,
})

/**
 * 노트 하나.
 *
 * 브랜드(`brandDetailQuery`)처럼 목록에서 골라내지 않고 상세 엔드포인트를 부릅니다 —
 * 브랜드는 상세 API 가 없어 그랬던 것이고, 노트는 있습니다. 주소로 바로 열었을 때
 * 246개를 통째로 받지 않아도 됩니다.
 */
export const noteDetailQuery = (noteId: number) =>
  queryOptions({
    queryKey: noteKeys.detail(noteId),
    queryFn: () => getNote(noteId),
    staleTime: CATALOG_STALE_TIME,
  })

/** 그 노트가 들어간 향수 한 쪽. `page` 는 0부터입니다 */
export const notePerfumesQuery = (noteId: number, page: number) =>
  queryOptions({
    queryKey: noteKeys.perfumes(noteId, page),
    queryFn: () => getNotePerfumes(noteId, page),
  })
