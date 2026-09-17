import { http } from '@/shared/api/http'

import type { Note, NotePerfumesResponse } from './types'

// 경로에 '/api/v1' 을 붙이지 않습니다 — http 의 baseURL 에 이미 있습니다

/** `GET /notes` 응답 껍데기. 목록만 꺼내 돌려주므로 밖으로 내보내지 않습니다 */
interface NotesResponse {
  notes: Note[]
}

/**
 * 노트 전체 (A35). 로그인이 필요 없습니다.
 *
 * **페이지가 없습니다** — 246개가 한 번에 옵니다. 화면이 대분류로 묶어 그리려면
 * 전부 있어야 해서입니다(향수처럼 늘어나는 값이 아닙니다).
 *
 * **받은 순서를 지켜야 합니다.** 대분류 순 · 그 안에서 인기 순으로 정렬되어 오고,
 * 화면은 그 순서를 대분류가 바뀌는 자리에서 끊어 섹션을 만듭니다. 다시 정렬하면
 * 섹션이 뒤섞입니다.
 *
 * **검색어 파라미터가 없습니다.** 246개를 이미 다 들고 있으니 거르는 일은 화면이
 * 합니다(`noteListQuery` 의 select).
 */
export async function getNotes(): Promise<Note[]> {
  const { data } = await http.get<NotesResponse>('/notes')
  return data.notes
}

/** 노트 하나 (A36). 목록의 한 줄과 같은 모양입니다 */
export async function getNote(noteId: number): Promise<Note> {
  const { data } = await http.get<Note>(`/notes/${noteId}`)
  return data
}

/**
 * 그 노트가 들어간 향수 (A36 아래). **페이지가 있습니다.**
 *
 * 노트 목록과 다른 점입니다 — 인기 노트 하나에 향수가 수만 개 달립니다
 * (머스크 49,571개). 전부 받으려 들면 화면이 멈춥니다.
 *
 * 없는 노트는 404 입니다. 빈 목록이 아니라서 화면이 "향수가 없는 노트" 와
 * "잘못된 번호" 를 구분할 수 있습니다.
 */
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
