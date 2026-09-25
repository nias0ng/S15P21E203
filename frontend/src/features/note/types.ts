import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

export interface Note {
  noteId: number
  name: string
  nameKo: string | null
  /**
   * 대분류. NOTE: 외래 키가 아닌 열린 문자열이라 화면에 고정 목록을 두지 않습니다.
   * 향 지도의 향 계열(9가지)과 다른 어휘입니다 — 섞어 쓰면 대분류가 통째로 사라집니다.
   */
  accordFamily: string | null
  imageUrl: string | null
  popularityRank: number | null
}

export interface NoteDetail extends Note {
  description: string | null
}

interface NotePerfume {
  perfumeId: number
  name: string
  nameKo: string | null
  brandName: string | null
  brandNameKo: string | null
  imageUrl: string | null
  scentFamily: ScentFamilyKey | null
}

export interface NotePerfumesResponse {
  perfumes: NotePerfume[]
  page: number
  size: number
  totalElements: number
}
