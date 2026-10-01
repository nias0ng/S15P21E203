import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { toNoteDetail } from '@/shared/config/routes'
import { localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { groupNoteStages, NOTE_FLAT, NOTE_OTHER } from '@/shared/lib/noteStages'
import { useLocale } from '@/shared/store/localeStore'
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
                    {localizedName(locale, note.name, note.nameKo)}
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
