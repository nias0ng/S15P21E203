import { cn } from '@/shared/lib/cn'

type CardProps = React.ComponentPropsWithRef<'div'> & {
  /** 마우스를 올렸을 때 살짝 떠오르게 합니다. 목록에서 클릭 가능한 카드에 씁니다. */
  interactive?: boolean
}

/**
 * 향수 카드·후기 카드·컬렉션 카드처럼 목록에 반복되는 박스의 공통 껍데기.
 * 내용은 children 으로 각 도메인이 채웁니다.
 *
 * `data-slot="card"` 는 **화면 테마가 붙잡을 자리 이름**입니다(`PerfumeCard` ·
 * `TileCard` 와 같은 이름). 어두운 방의 유리판은 이 이름으로 카드를 찾아 한 단 밝은
 * 서리 유리로 바꾸고 글자색을 먹색으로 되돌립니다
 * (`styles/scent-display.css` 의 `.scent-glass [data-slot='card']`).
 * 테마가 클래스명이 아니라 자리 이름을 잡는 덕에 이 컴포넌트는 화면을 모릅니다.
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
