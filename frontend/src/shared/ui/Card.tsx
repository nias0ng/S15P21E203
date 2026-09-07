import { cn } from '@/shared/lib/cn'

type CardProps = React.ComponentPropsWithRef<'div'> & {
  /** 마우스를 올렸을 때 살짝 떠오르게 합니다. 목록에서 클릭 가능한 카드에 씁니다. */
  interactive?: boolean
}

/**
 * 향수 카드·후기 카드·컬렉션 카드처럼 목록에 반복되는 박스의 공통 껍데기.
 * 내용은 children 으로 각 도메인이 채웁니다.
 */
export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border-line border bg-white p-4',
        interactive &&
          'hover:border-slate cursor-pointer transition-shadow hover:shadow-md',
        className,
      )}
      {...props}
    />
  )
}
