import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  name: string
  /** 브랜드명. 브랜드가 없는 향수는 null 이라 줄을 그리지 않습니다 */
  brand?: string | null
  /** 대표 이미지. 없으면 와이어프레임처럼 "이미지" 자리표시자를 그립니다. */
  thumbnailUrl?: string | null
  /**
   * 좌상단 원형 번호. **순위가 아니라 지금 목록에서 몇 번째인가** 입니다 —
   * 필터를 걸면 걸린 결과 안에서 1번부터 다시 셉니다. 필터링된 목록에 전체 순위를
   * 박으면 1번 다음이 7번이 됩니다.
   *
   * 안 넘기면 배지를 그리지 않습니다(컬렉션 · 진열대처럼 순서가 뜻이 없는 곳).
   */
  rank?: number
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
 *
 * 병 사진이 `contain` 인 이유: `cover` 는 세로로 긴 병의 위아래를 잘라 뚜껑 없는
 * 병이 늘어섭니다. 향수는 병 실루엣이 곧 정체성이라 잘리면 안 됩니다.
 * 테두리를 거의 없앴으므로 기본 상태의 옅은 그림자가 카드의 경계 역할을 합니다.
 */
export function PerfumeCard({
  name,
  brand,
  thumbnailUrl,
  rank,
  to,
  badges,
  footer,
  className,
}: PerfumeCardProps) {
  const body = (
    <>
      {/* 번호를 사진 위에 얹으므로 사진 칸이 위치 기준이 됩니다 */}
      <div className="relative">
        <Thumbnail
          src={thumbnailUrl}
          fallback="이미지"
          fit="contain"
          /*
           * 7:6 인 이유: 정사각이면 세로로 긴 병의 좌우에만 여백이 남아 카드가 키만
           * 커집니다. 병 실루엣을 다 담으면서 다섯 장이 한 화면에 들어오는 비율입니다.
           */
          className="bg-surface-card rounded-card aspect-7/6 w-full border-transparent p-3"
        />

        {rank !== undefined && (
          <span
            className={cn(
              'absolute top-2 left-2 flex size-8 items-center justify-center',
              'border-accent/40 bg-surface-card text-accent-deep rounded-full border',
              'text-caption font-serif',
            )}
          >
            {/*
              읽히는 문구와 보이는 숫자를 따로 둡니다. 숫자 앞뒤에 sr-only 를 끼우면
              문장이 세 노드로 갈라져 "목록 3번째" 가 한 덩어리로 잡히지 않습니다.
            */}
            <span className="sr-only">목록 {rank}번째</span>
            <span aria-hidden>{rank}</span>
          </span>
        )}
      </div>

      <div className="w-full space-y-0.5">
        <p className="text-ink text-body w-full truncate font-serif font-semibold">
          {name}
        </p>
        {brand && (
          <p className="text-ink-muted text-caption w-full truncate">{brand}</p>
        )}
      </div>

      {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
    </>
  )

  const shell = cn(
    'border-line/50 bg-surface-veil rounded-panel flex flex-col gap-3 border p-3',
    'shadow-card',
    className,
  )

  return (
    <article className={cn(!to && shell)}>
      {to ? (
        <Link
          to={to}
          className={cn(
            shell,
            'transition-[transform,box-shadow] duration-200 ease-out',
            'hover:shadow-raised hover:-translate-y-1',
          )}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </article>
  )
}
