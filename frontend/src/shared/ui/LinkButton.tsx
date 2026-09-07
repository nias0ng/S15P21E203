import { type VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

type LinkButtonProps = LinkProps & VariantProps<typeof buttonVariants>

/**
 * 버튼처럼 보이는 링크.
 *
 * 화면 이동은 링크여야 합니다. 새 탭으로 열기 · 링크 복사 · 스크린리더의 링크 목록이
 * 전부 이것에 달려 있습니다. onClick 으로 navigate 하는 버튼은 그걸 다 잃습니다.
 * 스타일은 Button 과 같은 정의(buttonVariants)를 공유합니다.
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
