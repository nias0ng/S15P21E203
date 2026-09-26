import { cn } from '@/shared/lib/cn'

export function Checkbox({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'border-line bg-surface-card size-3.75 shrink-0 appearance-none border',
        'checked:bg-ink',
        'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
