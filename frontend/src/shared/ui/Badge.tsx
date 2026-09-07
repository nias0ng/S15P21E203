import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        brand: 'bg-brand-100 text-brand-700',
        neutral: 'bg-ink/5 text-ink-muted',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-800',
        danger: 'bg-red-100 text-red-700',
      },
    },
    defaultVariants: { tone: 'brand' },
  },
)

type BadgeProps = React.ComponentPropsWithRef<'span'> &
  VariantProps<typeof badgeVariants>

/** 향 계열, 노트, 보유 중 여부처럼 짧은 라벨을 표시합니다. */
export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
