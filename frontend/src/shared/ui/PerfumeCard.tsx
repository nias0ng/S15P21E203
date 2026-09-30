import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  name: string
  subName?: string | null
  rank?: number
  /** 순위 딱지를 읽을 때 앞에 붙는 말 — `인기 1위` · `추천 1위` */
  rankLabel?: string
  thumbnailUrl?: string | null
} & (
  | {
      /** 누르면 가는 상세 주소 — 카드 전체가 링크입니다 */
      to: string
      state?: LinkProps['state']
    }
  | {
      /**
       * 링크 대신 누르면 카드 아래의 칸을 여닫는 단추입니다 (자연어 추천 결과 — 이유를 먼저 보고
       * 상세로 갑니다). 여닫는 칸은 부르는 쪽이 그립니다.
       */
      onToggle: () => void
      expanded: boolean
      /** 여닫는 칸의 id */
      controls?: string
    }
)

const SLOT = 'aspect-square w-full px-7.5 pt-3.75 pb-5'
const PLATE = 'rounded-image border border-black/5 bg-white'
const CARD =
  'border-line bg-surface-card rounded-card flex h-full flex-1 flex-col gap-1.25 border p-2.5 transition-[transform,box-shadow] duration-200 ease-out hover:shadow-raised hover:-translate-y-1.25'

export function PerfumeCard(props: PerfumeCardProps) {
  const { name, subName, rank, rankLabel = '인기', thumbnailUrl } = props

  /*
    NOTE: 안쪽은 전부 `span` 입니다 — 단추(`<button>`) 안에는 `div` · `p` 를 둘 수 없습니다.
    모양은 `block` 으로 링크일 때와 같게 둡니다.
  */
  const body = (
    <>
      <span className={cn(PLATE, 'relative block w-full')}>
        {thumbnailUrl ? (
          <Thumbnail
            src={thumbnailUrl}
            fit="contain"
            bare
            className={cn(
              SLOT,
              'drop-shadow-[0_2px_2px_rgb(0_0_0/0.16),0_9px_12px_rgb(0_0_0/0.22)]',
              'saturate-125',
            )}
          />
        ) : (
          <BottleSilhouette className={cn(SLOT, 'text-charcoal-soft/25')} />
        )}

        {rank != null && (
          <span
            data-slot="rank"
            className={cn(
              'absolute top-0 left-0 flex size-7.5 items-center justify-center',
              'bg-line-soft/85 text-ink text-caption rounded-full font-medium backdrop-blur-sm',
            )}
          >
            <span aria-hidden>{rank}</span>
            <span className="sr-only">
              {rankLabel} {rank}위
            </span>
          </span>
        )}
      </span>

      <span className="block min-h-15 w-full space-y-0.5 px-0.75">
        <span className="text-ink text-body line-clamp-2 font-serif leading-tight font-semibold">
          {name}
        </span>

        {subName && subName !== name && (
          <span className="text-ink-muted text-caption block truncate">
            {subName}
          </span>
        )}
      </span>
    </>
  )

  return (
    <article className="type-reading flex h-full flex-col">
      {'to' in props ? (
        <Link
          to={props.to}
          state={props.state}
          data-slot="card"
          className={CARD}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={props.expanded}
          aria-controls={props.controls}
          onClick={props.onToggle}
          data-slot="card"
          className={cn(
            CARD,
            'w-full text-left',
            // 연 카드는 떠오른 채로 테를 짙게 둡니다 — 아래 칸이 어느 카드의 것인지 보입니다
            props.expanded && 'border-ink -translate-y-1.25',
          )}
        >
          {body}
        </button>
      )}
    </article>
  )
}
