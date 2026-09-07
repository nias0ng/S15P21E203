import { cn } from '@/shared/lib/cn'

/**
 * 로딩 중 자리를 잡아두는 회색 블록.
 *
 * 목록을 불러오는 동안 화면 전체를 스피너로 덮으면(PageFallback) 레이아웃이 한 번 튑니다.
 * 실제 카드와 같은 크기의 Skeleton 을 먼저 깔면 데이터가 도착해도 화면이 흔들리지 않습니다.
 *
 *   {isPending ? <Skeleton className="h-40" /> : <PerfumeCard ... />}
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentPropsWithRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('bg-brand-100 rounded-card animate-pulse', className)}
      {...props}
    />
  )
}
