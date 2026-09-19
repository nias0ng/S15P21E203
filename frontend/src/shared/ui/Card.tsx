import { cn } from '@/shared/lib/cn'

type CardProps = React.ComponentPropsWithRef<'div'> & {
  /** 마우스를 올렸을 때 살짝 떠오르게 합니다. 목록에서 클릭 가능한 카드에 씁니다. */
  interactive?: boolean
}

/**
 * 목록에 반복되는 박스의 공통 껍데기. 내용은 children 으로 각 도메인이 채웁니다.
 * `data-slot="card"` 는 화면 테마가 붙잡을 자리 이름 — docs/어두운-방-유리판.md
 */
export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-card border-line bg-surface-card border p-3.75',
        interactive && 'hover:border-accent hover:shadow-raised cursor-pointer',
        'transition-[border-color,box-shadow] duration-200 ease-out',
        className,
      )}
      {...props}
    />
  )
}
