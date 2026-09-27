import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  name: string
  subName?: string | null
  rank?: number
  thumbnailUrl?: string | null
  to: string
  state?: LinkProps['state']
}

const SLOT = 'aspect-square w-full px-7.5 pt-3.75 pb-5'
const PLATE = 'rounded-image border border-black/5 bg-white'

export function PerfumeCard({
  name,
  subName,
  rank,
  thumbnailUrl,
  to,
  state,
}: PerfumeCardProps) {
  const body = (
    <>
      <div className={cn(PLATE, 'relative w-full')}>
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
            <span className="sr-only">인기 {rank}위</span>
          </span>
        )}
      </div>

      <div className="min-h-15 w-full space-y-0.5 px-0.75">
        <p className="text-ink text-body line-clamp-2 font-serif leading-tight font-semibold">
          {name}
        </p>

        {subName && subName !== name && (
          <p className="text-ink-muted text-caption truncate">{subName}</p>
        )}
      </div>
    </>
  )

  return (
    <article className="type-reading flex h-full flex-col">
      <Link
        to={to}
        state={state}
        data-slot="card"
        className={cn(
          'border-line bg-surface-card rounded-card flex h-full flex-col gap-1.25 border p-2.5',
          'flex-1',
          'transition-[transform,box-shadow] duration-200 ease-out',
          'hover:shadow-raised hover:-translate-y-1.25',
        )}
      >
        {body}
      </Link>
    </article>
  )
}
