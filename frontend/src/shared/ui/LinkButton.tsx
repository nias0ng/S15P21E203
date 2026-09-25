import { type VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

type LinkButtonProps = LinkProps & VariantProps<typeof buttonVariants>

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
