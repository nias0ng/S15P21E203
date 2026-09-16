import { cn } from '@/shared/lib/cn'

type Props = {
  /** 현재 페이지. **0부터 시작합니다** (백엔드와 같습니다) */
  page: number
  size: number
  totalElements: number
  onPageChange: (page: number) => void
  /** 낭독기가 읽을 이름. 한 화면에 목록이 둘이면 구분이 필요합니다 */
  label?: string
  className?: string
}

/** 한 번에 보여줄 페이지 번호 수. 홀수여야 현재 페이지가 가운데에 옵니다. */
const WINDOW = 5

/**
 * 페이지 넘김 (게시판 · 댓글 공용)
 *
 * 백엔드 목록 응답이 전부 `page`(0부터) · `size` · `totalElements` 라서 그대로
 * 받습니다. `totalPages` 는 어느 응답에도 없어 여기서 셉니다.
 *
 * **페이지가 하나뿐이면 아무것도 그리지 않습니다** — 늘 비활성인 단추 두 개는
 * 군더더기입니다.
 *
 * 번호를 다섯 개만 보여주는 이유: 글이 쌓이면 페이지가 수십 개가 되는데 전부
 * 그리면 줄이 넘칩니다. 현재 페이지를 가운데 두고 앞뒤로 두 개씩 보여주고,
 * 양 끝에서는 그만큼 반대쪽으로 채웁니다.
 */
export function Pagination({
  page,
  size,
  totalElements,
  onPageChange,
  label = '페이지',
  className,
}: Props) {
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
      aria-label={label}
      className={cn('flex items-center justify-center gap-1.25', className)}
    >
      <PageButton
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 0}
        label="이전 페이지"
      >
        이전
      </PageButton>

      {pages.map((value) => (
        <PageButton
          key={value}
          onClick={() => onPageChange(value)}
          current={value === page}
          // 사용자에게는 1부터 세는 번호를 보여줍니다
          label={`${value + 1}쪽`}
        >
          {value + 1}
        </PageButton>
      ))}

      <PageButton
        onClick={() => onPageChange(page + 1)}
        disabled={page >= lastPage}
        label="다음 페이지"
      >
        다음
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
      // 지금 보고 있는 쪽은 색만으로 알리지 않습니다 — 낭독기도 알아야 합니다
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
