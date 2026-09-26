import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

type FileButtonProps = {
  onPick: (file: File) => void
  inputLabel: string
  busy?: boolean
  accept?: string
  className?: string
  children: React.ReactNode
}

export function FileButton({
  onPick,
  inputLabel,
  busy = false,
  accept = IMAGE_ACCEPT,
  className,
  children,
}: FileButtonProps) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'cursor-pointer',
        'has-[:focus-visible]:ring-accent-deep has-[:focus-visible]:ring-2',
        busy && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={inputLabel}
        disabled={busy}
        onChange={(event) => {
          const picked = event.target.files?.[0]
          event.target.value = ''
          if (picked) onPick(picked)
        }}
      />
    </label>
  )
}
