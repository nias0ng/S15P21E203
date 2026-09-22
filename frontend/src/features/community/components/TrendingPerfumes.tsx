import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL_ASIDE } from '@/shared/ui/panel'

import type { TrendingPerfume } from '../types'

type Props = {
  items: TrendingPerfume[]
  /** 집계한 기간(일). 서버가 알려준 값을 그대로 적습니다 */
  days?: number
  /** 게시판이 그리드에서 어느 칸 · 어느 줄에 놓을지 정합니다 */
  className?: string
}

/**
 * 지금 많이 언급되는 향수 (A22a · A22b 우측). 향수를 누르면 향수 상세(A10)로
 * 갑니다 — "그 향수의 후기만 모아 보는" 별도 화면은 만들지 않기로 확정됐습니다.
 *
 * 곁판도 유리입니다(`GLASS_PANEL_ASIDE`) — docs/어두운-방-유리판.md
 */
export function TrendingPerfumes({ items, days, className }: Props) {
  if (items.length === 0) return null

  return (
    <aside className={cn(GLASS_PANEL_ASIDE, 'self-start', className)}>
      <h2 className="text-ink text-heading font-serif font-bold">
        지금 많이 언급되는 향수
      </h2>

      <ol className="mt-2.5 space-y-1.25">
        {items.map((item, rank) => (
          <li key={item.perfumeId}>
            <Link
              to={toPerfumeDetail(item.perfumeId)}
              state={perfumeViewState('COMMUNITY')}
              className={cn(
                /* 판 위의 hover 는 **어둡게** — docs/어두운-방-유리판.md */
                'hover:bg-surface-sunken rounded-card flex items-baseline gap-2.5 px-2.5 py-2.5',
                'transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
              )}
            >
              {/*
                tabular-nums 는 두 자리가 되어도 이름 시작점이 안 밀리게 합니다.
                폭은 좁은 화면에서 줄어든 뒤에도 두 자리(10위)가 들어갈 만큼입니다 —
                글자는 안 줄어들어 15px 로는 1536 에서 숫자가 이름에 닿습니다.
              */}
              <span className="text-ink-muted text-caption w-5 shrink-0 tabular-nums">
                {rank + 1}
              </span>
              <span className="text-ink text-body min-w-0 flex-1 truncate">
                {item.name}
              </span>
              <span className="text-ink-muted text-caption shrink-0">
                {item.mentionCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {/* 오른쪽 숫자가 무엇인지 한 번만 말해 둡니다 — 줄마다 "글" 을 붙이면 시끄럽습니다 */}
      <p className="text-ink-muted text-caption border-line-soft mt-2.5 border-t pt-2.5">
        {days === undefined
          ? '언급된 글 수'
          : `최근 ${days}일 동안 언급된 글 수`}
      </p>
    </aside>
  )
}
