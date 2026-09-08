import { type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

type ButtonProps = React.ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** true 면 스피너를 띄우고 클릭을 막습니다. 폼 제출 중에 씁니다. */
    isLoading?: boolean
  }

/**
 * 버튼. 화면 이동이 목적이면 이 컴포넌트가 아니라 LinkButton 을 쓰세요.
 * button 안에 링크를 넣는 것은 잘못된 마크업이고 키보드 동작도 깨집니다.
 */
export function Button({
  className,
  variant,
  size,
  fullWidth,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // type 을 안 주면 form 안에서 submit 으로 동작해 의도치 않게 폼이 전송됩니다.
      type="button"
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
