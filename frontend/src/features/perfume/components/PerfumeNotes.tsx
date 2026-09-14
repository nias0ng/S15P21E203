import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { PANEL } from '@/shared/ui/panel'

import type { PerfumeDetail } from '../types'

type Props = { notes: PerfumeDetail['notes'] }

/**
 * 향수 상세 ② 향조 (와이어프레임 A10 — DTL-02)
 *
 * ⚠️ 향조는 백엔드 응답에 아직 없습니다. 값이 없으면 안내 문구만 보여줍니다.
 * 이전에는 notes 가 필수 타입이라 undefined 를 그대로 읽어 화면 전체가
 * 죽었습니다(S15P21E203-169).
 */
export function PerfumeNotes({ notes }: Props) {
  const rows = [
    ['탑 노트', notes?.top ?? []],
    ['미들 노트', notes?.middle ?? []],
    ['베이스 노트', notes?.base ?? []],
  ] as const

  const isEmpty = rows.every(([, items]) => items.length === 0)

  return (
    <section className={cn(PANEL, 'space-y-3')}>
      <h2 className="text-ink-muted text-[10.5px]">향조</h2>

      {isEmpty ? (
        // TODO: 백엔드 DTL-02 응답 연결
        <p className="text-ink-muted text-xs">
          향조 정보가 아직 등록되지 않았습니다.
        </p>
      ) : (
        rows.map(([label, items]) => (
          <div key={label} className="flex items-center gap-4">
            <span className="text-ink w-20 shrink-0 text-xs">{label}</span>
            <div className="flex flex-wrap gap-1.5">
              {items.length === 0 ? (
                <span className="text-ink-muted text-xs">—</span>
              ) : (
                items.map((note) => (
                  <Badge key={note} tone="outline">
                    {note}
                  </Badge>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
