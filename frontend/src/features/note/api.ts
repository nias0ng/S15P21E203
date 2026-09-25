import { http } from '@/shared/api/http'

import type { Note, NoteDetail, NotePerfumesResponse } from './types'

interface NotesResponse {
  notes: Note[]
}

// NOTE: 받은 순서(대분류 순 · 그 안 인기 순)를 지켜야 화면이 섹션을 끊을 수 있습니다.
export async function getNotes(): Promise<Note[]> {
  const { data } = await http.get<NotesResponse>('/notes')
  return data.notes
}

export async function getNote(noteId: number): Promise<NoteDetail> {
  const { data } = await http.get<NoteDetail>(`/notes/${noteId}`)
  return data
}

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
