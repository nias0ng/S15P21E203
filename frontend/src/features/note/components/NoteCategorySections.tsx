import { useMemo } from 'react'

import { toNoteDetail } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Thumbnail } from '@/shared/ui/Thumbnail'
import { TileCard } from '@/shared/ui/TileCard'

import type { Note } from '../types'

type Props = {
  notes: Note[]
  isPending?: boolean
  /** 0건 안내 아래 버튼. 검색어로 걸러 0건이 된 경우 [초기화] 를 답니다. */
  emptyAction?: React.ReactNode
}

/** 대분류가 비어 있는 노트도 있습니다. 묶어서 맨 뒤에 둡니다 */
const UNCATEGORIZED = '기타'

/**
 * 대분류별 노트 섹션 (와이어프레임 A35)
 *
 * 와이어프레임 주석: "대분류(CITRUS · WOOD · FLORAL …)로 묶어 세로로 쌓는다 —
 * 대분류 순서는 고정".
 *
 * **고정 목록을 두지 않고 받은 순서를 끊습니다.** 대분류는 백엔드가 원본 파일의
 * 코드를 그대로 내보내는 열린 문자열이라, 화면이 목록을 들고 있으면 새 값이 생긴
 * 날 그 노트들이 조용히 사라집니다(목록에 없는 대분류는 어느 섹션에도 안 걸립니다).
 * 응답이 이미 대분류 순 · 인기 순으로 오므로 대분류가 바뀌는 자리에서 끊으면
 * 순서도 고정이고 새 값도 제 자리에 그려집니다.
 */
export function NoteCategorySections({
  notes,
  isPending = false,
  emptyAction,
}: Props) {
  const sections = useMemo(() => groupByAccordFamily(notes), [notes])

  if (isPending) {
    return (
      <div className="space-y-6.25">
        {Array.from({ length: 2 }, (_, section) => (
          <div key={section} className="space-y-2.5">
            <Skeleton className="h-5 w-23.75" />
            <div className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
              {/*
                카드와 같은 틀 · 같은 사진 비율이어야 노트가 도착할 때 격자가 안
                튑니다. 사진이 7:5 라 높이가 열 폭을 따라가서, 고정 높이로는 못 맞춥니다.
              */}
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="border-line rounded-card flex flex-col gap-2.5 border p-2.5"
                >
                  <Skeleton className="aspect-7/5 w-full" />
                  {/* 영문 이름 · 한국어 이름 두 줄 */}
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <EmptyState
        title="노트를 찾지 못했습니다"
        description="노트명을 다시 확인해 주세요."
        action={emptyAction}
      />
    )
  }

  return (
    <div className="space-y-7.5">
      {sections.map((section) => (
        <section key={section.family} className="space-y-2.5">
          <h2 className="text-ink text-title font-serif font-semibold">
            {section.family}
          </h2>
          <ul className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-5">
            {section.notes.map((note) => (
              <li key={note.noteId}>
                <TileCard
                  to={toNoteDetail(note.noteId)}
                  media={
                    <Thumbnail
                      src={note.imageUrl}
                      fallback="이미지"
                      /*
                        노트 사진은 7:5(가로:세로)로 맞춰 올라옵니다. 높이를 고정하면
                        열 폭이 바뀌는 순간 object-cover 가 좌우를 잘라내므로, 비율로
                        잡고 높이가 폭을 따라오게 둡니다.
                      */
                      className="aspect-7/5 w-full"
                    />
                  }
                  /*
                    향수 카드와 같은 약속입니다 — 영문 이름을 크게, 한국어 이름을
                    그 아래 작게. 한국어 이름이 없는 노트는 아랫줄이 비고, 두 값이
                    같으면 같은 글자가 두 줄로 겹치지 않게 뺍니다.
                  */
                  title={note.name}
                  caption={note.nameKo !== note.name ? note.nameKo : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * 받은 순서 그대로 대분류가 바뀌는 자리에서 끊습니다.
 *
 * 같은 대분류가 목록에서 떨어져 두 번 나오면 섹션도 둘이 됩니다. 응답이 대분류 순
 * 정렬이라 실제로는 생기지 않지만, 그렇게 되는 편이 **순서가 흐트러진 것을 화면에서
 * 보이게** 합니다 — 몰래 합치면 정렬이 깨진 줄 모르고 넘어갑니다.
 */
function groupByAccordFamily(notes: Note[]) {
  const sections: { family: string; notes: Note[] }[] = []

  for (const note of notes) {
    const family = note.accordFamily ?? UNCATEGORIZED
    const last = sections.at(-1)

    if (last?.family === family) last.notes.push(note)
    else sections.push({ family, notes: [note] })
  }

  return sections
}
