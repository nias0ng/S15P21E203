import { queryOptions } from '@tanstack/react-query'

import { keywordMatcher } from '@/shared/lib/keywordMatch'

import { getNote, getNotePerfumes, getNotes } from './api'
import { noteFamilies } from './grouping'
import type { Note } from './types'

const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (noteId: number) => [...noteKeys.details(), noteId] as const,
  perfumes: (noteId: number, page: number) =>
    [...noteKeys.detail(noteId), 'perfumes', page] as const,
}

/** 카탈로그는 자주 바뀌지 않고 전체가 한 번에 오는 응답이라 기본값(1분)보다 길게 둡니다 */
const CATALOG_STALE_TIME = 1000 * 60 * 10

/** 검색어는 캐시 키에 넣지 않습니다 — 넣으면 글자를 칠 때마다 246개를 다시 받습니다 */
export const noteListQuery = (keyword: string) =>
  queryOptions({
    queryKey: noteKeys.lists(),
    queryFn: getNotes,
    staleTime: CATALOG_STALE_TIME,
    select: (notes: Note[]) => filterNotes(notes, keyword),
  })

/** 한국어 이름이 없는 노트가 있습니다 */
function filterNotes(notes: Note[], keyword: string): Note[] {
  if (!keyword.trim()) return notes

  const matches = keywordMatcher(keyword)
  return notes.filter((note) => matches(note.name, note.nameKo))
}

/** 검색 결과가 아니라 전체 노트에서 뽑습니다 — 걸린 것만으로 만들면 알약 줄 수가 오르내립니다 */
export const noteFamiliesQuery = queryOptions({
  queryKey: noteKeys.lists(),
  queryFn: getNotes,
  staleTime: CATALOG_STALE_TIME,
  select: noteFamilies,
})

export const noteDetailQuery = (noteId: number) =>
  queryOptions({
    queryKey: noteKeys.detail(noteId),
    queryFn: () => getNote(noteId),
    staleTime: CATALOG_STALE_TIME,
  })

/** `page` 는 0부터입니다 */
export const notePerfumesQuery = (noteId: number, page: number) =>
  queryOptions({
    queryKey: noteKeys.perfumes(noteId, page),
    queryFn: () => getNotePerfumes(noteId, page),
  })
