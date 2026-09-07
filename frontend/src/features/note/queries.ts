import { queryOptions } from '@tanstack/react-query'

import { getNoteDetail, getNotes } from './api'

export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (keyword: string) => [...noteKeys.lists(), keyword] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (noteId: number) => [...noteKeys.details(), noteId] as const,
}

export const noteListQuery = (keyword: string) =>
  queryOptions({
    queryKey: noteKeys.list(keyword),
    queryFn: () => getNotes(keyword),
  })

export const noteDetailQuery = (noteId: number) =>
  queryOptions({
    queryKey: noteKeys.detail(noteId),
    queryFn: () => getNoteDetail(noteId),
  })
