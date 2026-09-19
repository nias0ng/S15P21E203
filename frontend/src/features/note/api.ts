import { http } from '@/shared/api/http'

import type { Note, NoteDetail, NotePerfumesResponse } from './types'

/** `GET /notes` 응답 껍데기. 목록만 꺼내 돌려주므로 밖으로 내보내지 않습니다 */
interface NotesResponse {
  notes: Note[]
}

/**
 * 노트 전체 (A35). 로그인이 필요 없습니다.
 *
 * **페이지도 검색어 파라미터도 없습니다** — 246개가 한 번에 오고, 거르는 일은
 * 화면이 합니다(`noteListQuery` 의 select).
 *
 * **받은 순서를 지켜야 합니다** — 대분류 순 · 그 안에서 인기 순으로 오고, 화면은
 * 대분류가 바뀌는 자리에서 끊어 섹션을 만듭니다.
 */
export async function getNotes(): Promise<Note[]> {
  const { data } = await http.get<NotesResponse>('/notes')
  return data.notes
}

/**
 * 노트 하나 (A36). 목록의 한 줄에 **설명이 하나 더 붙습니다** — 목록에는 일부러
 * 빼 두었으니, 설명이 필요하면 목록 캐시에서 고르지 말고 이쪽을 부르세요.
 */
export async function getNote(noteId: number): Promise<NoteDetail> {
  const { data } = await http.get<NoteDetail>(`/notes/${noteId}`)
  return data
}

/**
 * 그 노트가 들어간 향수 (A36 아래). **페이지가 있습니다** — 인기 노트 하나에 향수가
 * 수만 개 달립니다(머스크 49,571개). 없는 노트는 빈 목록이 아니라 404 라, 화면이
 * "향수가 없는 노트" 와 "잘못된 번호" 를 구분할 수 있습니다.
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
