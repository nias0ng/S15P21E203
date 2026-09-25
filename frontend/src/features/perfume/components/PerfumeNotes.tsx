import { cn } from '@/shared/lib/cn'
import { groupNoteStages, NOTE_FLAT } from '@/shared/lib/noteStages'
import { Badge } from '@/shared/ui/Badge'
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
              {row.notes.map((note) => (
                <Badge key={note.noteId} tone="outline">
                  {note.name}
                </Badge>
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
