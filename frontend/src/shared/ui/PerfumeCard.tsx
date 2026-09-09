import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  name: string
  /** 브랜드명. 브랜드가 없는 향수는 null 이라 줄을 그리지 않습니다 */
  brand?: string | null
  /** 대표 이미지. 없으면 와이어프레임처럼 "이미지" 자리표시자를 그립니다. */
  thumbnailUrl?: string | null
  /** 카드를 누르면 갈 곳. 없으면 링크가 아닌 그냥 카드가 됩니다. */
  to?: string
  /** 향 계열 · 보유 중 같은 배지 (Badge 컴포넌트를 넘겨주세요) */
  badges?: React.ReactNode
  /** 카드 하단 동작 영역 — 진열대의 [대표 향수로 지정] 같은 것 */
  footer?: React.ReactNode
  className?: string
}

/**
 * 향수 카드 (와이어프레임 A33 · A09 · A13 · A17 · C02 공용)
 *
 * 여러 도메인(향수 · 진열대 · 컬렉션 · 커뮤니티)이 같은 카드를 쓰는데
 * features/a 는 features/b 를 import 할 수 없으므로 shared/ui 에 둡니다.
 * 그래서 도메인 타입(PerfumeSummary)을 받지 않고 필요한 값만 낱개로 받습니다.
 * 도메인 타입을 여기서 알게 되면 ESLint 가 막습니다.
 */
export function PerfumeCard({
  name,
  brand,
  thumbnailUrl,
  to,
  badges,
  footer,
  className,
}: PerfumeCardProps) {
  const body = (
    <>
      <Thumbnail src={thumbnailUrl} fallback="이미지" className="h-28 w-full" />

      <p className="text-ink w-full truncate text-xs font-bold">{name}</p>
      {brand && (
        <p className="text-ink-muted w-full truncate text-[10.5px]">{brand}</p>
      )}
      {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
    </>
  )

  const shell = cn(
    'border-line bg-surface-card flex flex-col gap-1.5 border p-2.5',
    className,
  )

  return (
    <article className={cn(!to && shell)}>
      {to ? (
        <Link
          to={to}
          className={cn(
            shell,
            'hover:border-accent transition-shadow hover:shadow-md',
          )}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {footer && <div className="mt-1.5">{footer}</div>}
    </article>
  )
}
