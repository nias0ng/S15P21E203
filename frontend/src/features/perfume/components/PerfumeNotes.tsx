import { useTranslation } from 'react-i18next'

import { localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { groupNoteStages, NOTE_FLAT, NOTE_OTHER } from '@/shared/lib/noteStages'
import { useLocale } from '@/shared/store/localeStore'
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
  const { t } = useTranslation('perfume')
  const locale = useLocale()
  const rows = toRows(notes, t('notes.other'))

  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75', className)}>
      <h2 className="text-ink text-title font-serif font-semibold">
        {t('notes.title')}
      </h2>

      {isPending ? (
        <p className="text-ink-muted text-body">{t('notes.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-muted text-body">{t('notes.empty')}</p>
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
                  {localizedName(locale, note.name, note.nameKo)}
                </Badge>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

// 단계를 모르는 노트의 묶음 이름(`NOTE_OTHER`)은 묶는 열쇠라 한국어로 두고, 보일 때만 바꿉니다
function toRows(notes: PerfumeNote[], otherLabel: string): NoteRow[] {
  return groupNoteStages(notes).map((group) => ({
    ...group,
    label:
      group.stage === NOTE_FLAT
        ? null
        : group.stage === NOTE_OTHER
          ? otherLabel
          : (STAGE_LABELS[group.stage] ?? group.stage),
  }))
}
