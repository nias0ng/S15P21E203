import { cn } from '@/shared/lib/cn'

export function Skeleton({
  className,
  ...props
}: React.ComponentPropsWithRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('bg-line-soft rounded-card animate-pulse', className)}
      {...props}
    />
  )
}
