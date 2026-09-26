import { cva } from 'class-variance-authority'

import { FOCUS_RING } from './focusRing'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2.5 rounded-card font-medium ' +
    'transition-colors duration-120 ease-out ' +
    FOCUS_RING +
    ' disabled:pointer-events-none disabled:border disabled:border-line ' +
    'disabled:bg-transparent disabled:text-ink-muted disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-surface hover:bg-ink-muted',
        outline:
          'border border-line bg-transparent text-ink hover:bg-line-soft',
        ghost:
          'bg-transparent text-ink-muted hover:bg-line-soft hover:text-ink',
        danger: 'bg-danger text-surface hover:bg-danger/90',
        navy: 'border border-line bg-navy text-ink hover:bg-navy/85',
        dangerOutline:
          'border border-danger/40 bg-transparent text-danger hover:bg-danger/5',
      },
      size: {
        sm: 'text-body h-7.5 min-h-[calc(var(--text-body)*var(--text-body--line-height)+5px)] px-2.5',
        md: 'text-body h-10 px-3.75',
        lg: 'text-body h-12.5 px-6.25',
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
