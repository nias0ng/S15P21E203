import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'

const badgeVariants = cva(
  'text-caption inline-flex items-center rounded-full px-2.5 py-1.25 font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-line-soft text-ink-muted',
        outline: 'border-line border bg-transparent text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type BadgeProps = React.ComponentPropsWithRef<'span'> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
