type EmptyStateProps = {
  /** "검색 결과가 없습니다" 처럼 상황을 한 줄로 */
  title: string
  /** 다음에 뭘 하면 되는지 안내 */
  description?: string
  /** 해결 동작 버튼 (예: 검색어 초기화) */
  action?: React.ReactNode
}

/**
 * 데이터가 0건일 때 빈 화면을 그냥 비워두지 않기 위한 컴포넌트.
 * 검색 결과·컬렉션·진열대·후기 목록 등 여러 곳에서 같은 모양으로 씁니다.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-ink-muted max-w-sm text-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
