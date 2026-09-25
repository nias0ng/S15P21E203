import { type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

type ButtonProps = React.ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
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
      type="button"
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="size-3.75 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
