import { cn } from '@/shared/lib/cn'

type ThumbnailProps = {
  src?: string | null
  fallback?: string
  fit?: 'cover' | 'contain'
  bare?: boolean
  className?: string
  alt?: string
}

export function Thumbnail({
  src,
  fallback,
  fit = 'cover',
  bare = false,
  className,
  alt = '',
}: ThumbnailProps) {
  const box = 'border-line bg-surface-sunken border'

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          !bare && box,
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        box,
        'text-ink-muted text-caption flex items-center justify-center',
        className,
      )}
    >
      {fallback}
    </span>
  )
}
