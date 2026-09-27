import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

type TileCardProps = {
  to: string
  media: React.ReactNode
  title: string
  caption?: React.ReactNode
  className?: string
}

export function TileCard({
  to,
  media,
  title,
  caption,
  className,
}: TileCardProps) {
  return (
    <Link
      to={to}
      data-slot="card"
      className={cn(
        'type-reading border-line bg-surface-card rounded-card flex flex-col gap-2.5 border p-2.5',
        'transition-[transform,box-shadow] duration-200 ease-out',
        'hover:shadow-raised hover:-translate-y-1.25',
        className,
      )}
    >
      {media}

      <span className="block space-y-0.5">
        <span className="text-ink text-heading block truncate font-serif font-semibold">
          {title}
        </span>
        {caption && (
          <span className="text-ink-muted text-caption block">{caption}</span>
        )}
      </span>
    </Link>
  )
}
