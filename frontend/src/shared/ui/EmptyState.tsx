import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'

type EmptyStateProps = {
  /** "검색 결과가 없습니다" 처럼 상황을 한 줄로 */
  title: string
  /** 다음에 뭘 하면 되는지 안내 */
  description?: string
  /** 해결 동작 버튼 (예: 검색어 초기화) */
  action?: React.ReactNode
  /** 넘기면 `action` 뒤에 [다시 시도] 단추가 섭니다. 불러오기에 실패한 자리에 씁니다 */
  onRetry?: () => void
  /** [다시 시도] 의 크기. 옆에 선 `action` 과 맞춥니다 */
  retrySize?: 'sm' | 'md'
}

/**
 * 데이터가 0건일 때 빈 화면을 그냥 비워두지 않기 위한 컴포넌트.
 * 검색 결과·컬렉션·진열대·후기 목록 등 여러 곳에서 같은 모양으로 씁니다.
 */
export function EmptyState({
  title,
  description,
  action,
  onRetry,
  retrySize = 'md',
}: EmptyStateProps) {
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
              다시 시도
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
