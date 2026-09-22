import { cn } from '@/shared/lib/cn'

/**
 * 로딩 중 자리를 잡아두는 회색 블록. 실제 카드와 같은 크기로 먼저 깔면 데이터가
 * 도착해도 화면이 흔들리지 않습니다.
 */
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
