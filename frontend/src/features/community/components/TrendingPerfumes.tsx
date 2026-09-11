import { Link } from 'react-router'

import { toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import type { TrendingPerfume } from '../types'

type Props = { items: TrendingPerfume[] }

/**
 * 지금 많이 언급되는 향수 (와이어프레임 A22a · A22b 우측)
 *
 * 와이어프레임 주석: "향수를 누르면 그 향수의 후기만 모아 본다 —
 * 커뮤니티가 향수 데이터에 붙는 지점".
 *
 * "그 향수의 후기만 모아 보는" 별도 화면은 **만들지 않기로 확정**되었습니다.
 * 향수 상세(A10)로 보내고, 상세의 후기 구역이 그 역할을 합니다.
 *
 * `self-start` 로 내용만큼만 높이를 씁니다. 예전에는 옆 목록 높이에 맞춰 늘어나서,
 * 글이 세 개일 때 상자 절반이 빈 채로 남았습니다.
 *
 * 순위 숫자를 붙인 이유: "많이 언급되는" 은 순서가 뜻을 갖는 목록인데, 숫자가 없으면
 * 그냥 향수 세 개를 나열한 것으로 읽힙니다.
 */
export function TrendingPerfumes({ items }: Props) {
  if (items.length === 0) return null

  return (
    <aside className="border-line rounded-card bg-surface-card self-start border p-3.75">
      <h2 className="text-ink text-heading font-serif font-bold">
        지금 많이 언급되는 향수
      </h2>

      <ol className="mt-2.5 space-y-1.25">
        {items.map((item, rank) => (
          <li key={item.perfumeId}>
            <Link
              to={toPerfumeDetail(item.perfumeId)}
              className={cn(
                'hover:bg-line-soft rounded-card flex items-baseline gap-2.5 px-2.5 py-2.5',
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
                {item.postCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {/* 오른쪽 숫자가 무엇인지 한 번만 말해 둡니다 — 줄마다 "글" 을 붙이면 시끄럽습니다 */}
      <p className="text-ink-muted text-caption border-line-soft mt-2.5 border-t pt-2.5">
        최근 한 주 동안 언급된 글 수
      </p>
    </aside>
  )
}
