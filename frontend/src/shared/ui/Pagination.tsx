import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

type Props = {
  page: number
  size: number
  totalElements: number
  onPageChange: (page: number) => void
  label?: string
  className?: string
}

const WINDOW = 5

export function Pagination({
  page,
  size,
  totalElements,
  onPageChange,
  label,
  className,
}: Props) {
  const { t } = useTranslation('layout')
  const lastPage = Math.max(0, Math.ceil(totalElements / size) - 1)
  if (lastPage === 0) return null

  const start = Math.max(
    0,
    Math.min(page - (WINDOW >> 1), lastPage - WINDOW + 1),
  )
  const pages = Array.from(
    { length: Math.min(WINDOW, lastPage + 1) },
    (_, index) => start + index,
  )

  return (
    <nav
      aria-label={label ?? t('pagination.label')}
      className={cn('flex items-center justify-center gap-1.25', className)}
    >
      <PageButton
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 0}
        label={t('pagination.previousPage')}
      >
        {t('pagination.previous')}
      </PageButton>

      {pages.map((value) => (
        <PageButton
          key={value}
          onClick={() => onPageChange(value)}
          current={value === page}
          label={t('pagination.page', { page: value + 1 })}
        >
          {value + 1}
        </PageButton>
      ))}

      <PageButton
        onClick={() => onPageChange(page + 1)}
        disabled={page >= lastPage}
        label={t('pagination.nextPage')}
      >
        {t('pagination.next')}
      </PageButton>
    </nav>
  )
}

function PageButton({
  children,
  onClick,
  disabled = false,
  current = false,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  current?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'rounded-card text-caption min-w-7.5 px-2.5 py-1.25',
        'transition-colors duration-120 ease-out',
        'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        current
          ? 'bg-ink text-surface-card font-medium'
          : 'text-ink-muted hover:bg-line-soft enabled:hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
