import { Link } from 'react-router'

import { toNoteDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { groupNoteStages, NOTE_FLAT } from '@/shared/lib/noteStages'
import { Badge } from '@/shared/ui/Badge'
import { FOCUS_RING } from '@/shared/ui/focusRing'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { PerfumeNote } from '../types'

type Props = {
  notes: PerfumeNote[]
  isPending?: boolean
  className?: string
}

const STAGE_LABELS: Record<string, string> = {
  TOP: 'Top',
  MIDDLE: 'Middle',
  BASE: 'Base',
}

type NoteRow = {
  stage: string
  label: string | null
  notes: PerfumeNote[]
}

export function PerfumeNotes({ notes, isPending = false, className }: Props) {
  const rows = toRows(notes)

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75', className)}>
      <h2 className="text-ink text-title font-serif font-semibold">향조</h2>

      {isPending ? (
        <p className="text-ink-muted text-body">향조를 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-body">
          향조 정보가 아직 등록되지 않았습니다.
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.stage} className="flex items-center gap-3.75">
            {row.label !== null && (
              <span className="text-ink text-body w-20 shrink-0">
                {row.label}
              </span>
            )}
            <div className="flex flex-wrap gap-1.25">
              {/*
                노트는 그 노트가 든 다른 향수로 가는 길입니다 — 노트를 누르면 대표 향수가 뜬다는
                것을 지인이 좋게 봤는데(지인 피드백 F18), 상세에서는 그 길이 닫혀 있었습니다.
              */}
              {row.notes.map((note) => (
                <Link
                  key={note.noteId}
                  to={toNoteDetail(note.noteId)}
                  className={cn('rounded-full', FOCUS_RING)}
                >
                  <Badge
                    tone="outline"
                    className="hover:border-ink hover:text-ink transition-colors duration-120"
                  >
                    {note.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function toRows(notes: PerfumeNote[]): NoteRow[] {
  return groupNoteStages(notes).map((group) => ({
    ...group,
    label:
      group.stage === NOTE_FLAT
        ? null
        : (STAGE_LABELS[group.stage] ?? group.stage),
  }))
}
