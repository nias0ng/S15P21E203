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

const CATALOG_STALE_TIME = 1000 * 60 * 10

export const noteListQuery = (keyword: string) =>
  queryOptions({
    queryKey: noteKeys.lists(),
    queryFn: getNotes,
    staleTime: CATALOG_STALE_TIME,
    select: (notes: Note[]) => filterNotes(notes, keyword),
  })

function filterNotes(notes: Note[], keyword: string): Note[] {
  if (!keyword.trim()) return notes

  const matches = keywordMatcher(keyword)
  return notes.filter((note) => matches(note.name, note.nameKo))
}

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
    // 설명이 요청 언어로 옵니다 — 화면 언어를 바꾸면 다시 받습니다
    meta: { localeDependent: true },
  })

export const notePerfumesQuery = (noteId: number, page: number) =>
  queryOptions({
    queryKey: noteKeys.perfumes(noteId, page),
    queryFn: () => getNotePerfumes(noteId, page),
  })
