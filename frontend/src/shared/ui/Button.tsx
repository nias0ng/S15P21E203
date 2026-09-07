import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'

/**
 * 버튼 스타일을 variant 조합으로 정의합니다.
 *
 * 화면마다 `className="bg-brand-500 px-4 py-2 rounded..."` 를 새로 쓰지 않고
 * `<Button variant="primary" size="md">` 로 쓰기 위한 것입니다.
 * 색은 반드시 styles/index.css 의 디자인 토큰(brand/ink/surface)만 씁니다.
 */
const buttonVariants = cva(
  // 모든 variant 가 공유하는 기본 스타일
  'inline-flex items-center justify-center gap-2 rounded-card font-medium ' +
    'transition-colors outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        outline:
          'border border-brand-200 bg-transparent text-ink hover:bg-brand-50',
        ghost: 'bg-transparent text-ink-muted hover:bg-brand-50 hover:text-ink',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = React.ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** true 면 스피너를 띄우고 클릭을 막습니다. 폼 제출 중에 씁니다. */
    isLoading?: boolean
  }

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
