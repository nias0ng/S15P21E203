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
}

/**
 * 지금 많이 언급되는 향수 (와이어프레임 A22a · A22b 우측)
 *
 * 향수를 누르면 향수 상세(A10)로 갑니다 — "그 향수의 후기만 모아 보는" 별도 화면은
 * 만들지 않기로 확정됐고, 상세의 후기 구역이 그 역할을 합니다.
 *
 * 순위 숫자를 붙인 이유: 숫자가 없으면 그냥 향수 세 개를 나열한 것으로 읽힙니다.
 *
 * **곁판도 유리입니다**(`GLASS_PANEL_ASIDE`). 어두운 방에서 `bg-surface-card` 는
 * `--night-soft`(#362f26)로 뒤집히므로, 그대로 두면 유리판 옆에 갈색 상자가 하나
 * 서 있는 모양이 됩니다. 폭이 255px 이라 본문 판보다 모서리와 여백이 작습니다.
 */
export function TrendingPerfumes({ items, days }: Props) {
  if (items.length === 0) return null

  return (
    <aside className={cn(GLASS_PANEL_ASIDE, 'self-start')}>
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
                /*
                  판 위의 hover 는 **어둡게** 합니다. 유리는 반투명이라 어둡게 하면
                  뒤의 방이 더 비쳐 그 줄이 유리 안으로 가라앉아 보이고, 글자가 밝은
                  쪽이라 대비도 같이 올라갑니다 (styles/scent-display.css 의
                  `--color-surface-sunken`).
                */
                'hover:bg-surface-sunken rounded-card flex items-baseline gap-2.5 px-2.5 py-2.5',
                'transition-colors duration-120 ease-out',
                'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
              )}
            >
              {/* tabular-nums 는 두 자리가 되어도 이름 시작점이 안 밀리게 합니다 */}
              <span className="text-ink-muted text-caption w-3.75 shrink-0 tabular-nums">
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
