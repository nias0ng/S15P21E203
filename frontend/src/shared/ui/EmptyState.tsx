import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'

type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
  onRetry?: () => void
  retrySize?: 'sm' | 'md'
}

export function EmptyState({
  title,
  description,
  action,
  onRetry,
  retrySize = 'md',
}: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-47.5 flex-col items-center justify-center gap-2.5 text-center">
      <p className="text-heading font-serif font-semibold">{title}</p>
      {description && (
        <p className="text-ink-muted text-body max-w-sm">{description}</p>
      )}
      {(action || onRetry) && (
        <div className={cn('mt-2.5', onRetry && 'flex gap-2.5')}>
          {action}
          {onRetry && (
            <Button variant="outline" size={retrySize} onClick={onRetry}>
              {t('actions.retry')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
