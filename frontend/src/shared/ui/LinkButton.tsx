import { type VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

type LinkButtonProps = LinkProps & VariantProps<typeof buttonVariants>

/**
 * 버튼처럼 보이는 링크. 새 탭으로 열기 · 링크 복사 · 낭독기의 링크 목록이 전부
 * 여기 달려 있어, onClick 으로 navigate 하는 버튼은 그걸 다 잃습니다.
 */
export function LinkButton({
  className,
  variant,
  size,
  fullWidth,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  )
}
