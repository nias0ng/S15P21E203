import { http } from '@/shared/api/http'

import type { Note, NoteDetail, NotePerfumesResponse } from './types'

interface NotesResponse {
  notes: Note[]
}

/**
 * 페이지도 검색어 파라미터도 없습니다 — 246개가 한 번에 오고 거르는 일은 화면이 합니다.
 * NOTE: 받은 순서(대분류 순 · 그 안 인기 순)를 지켜야 화면이 섹션을 끊을 수 있습니다.
 */
export async function getNotes(): Promise<Note[]> {
  const { data } = await http.get<NotesResponse>('/notes')
  return data.notes
}

/** 설명은 여기에만 옵니다 — 필요하면 목록 캐시에서 고르지 말고 이쪽을 부릅니다 */
export async function getNote(noteId: number): Promise<NoteDetail> {
  const { data } = await http.get<NoteDetail>(`/notes/${noteId}`)
  return data
}

/** 없는 노트는 빈 목록이 아니라 404 입니다 — "향수가 없는 노트" 와 구분됩니다 */
export async function getNotePerfumes(
  noteId: number,
  page = 0,
): Promise<NotePerfumesResponse> {
  const { data } = await http.get<NotePerfumesResponse>(
    `/notes/${noteId}/perfumes`,
    { params: { page } },
  )
  return data
}
