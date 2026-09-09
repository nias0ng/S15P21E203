import { cn } from '@/shared/lib/cn'

type SearchFieldProps = Omit<
  React.ComponentPropsWithRef<'input'>,
  'type' | 'id'
> & {
  /** 화면에 보이지 않는 라벨. 무엇을 검색하는지 밝혀야 합니다. */
  label: string
  /** 검색 버튼을 눌렀을 때. form 안에 있으면 submit 으로도 동작합니다. */
  onSearch?: (keyword: string) => void
  className?: string
}

/**
 * 검색 입력 + ⌕ 버튼 (와이어프레임 A33 · A09 · A34 · A35 · C02 공용)
 *
 * 헤더에는 검색창이 없고 각 페이지 안에 있다는 와이어프레임 규칙 때문에
 * 목록 화면마다 같은 모양이 반복됩니다. 그래서 shared/ui 에 둡니다.
 */
export function SearchField({
  label,
  onSearch,
  className,
  name = 'keyword',
  ...props
}: SearchFieldProps) {
  return (
    <form
      role="search"
      className={cn('flex items-stretch', className)}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSearch?.(String(data.get(name) ?? ''))
      }}
    >
      <label className="sr-only" htmlFor={`search-${name}`}>
        {label}
      </label>
      <input
        id={`search-${name}`}
        name={name}
        type="search"
        className={cn(
          'border-line text-ink placeholder:text-ink-muted min-w-0 flex-1 border px-3 py-3 text-xs',
          'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
        )}
        {...props}
      />
      <button
        type="submit"
        aria-label="검색"
        className="border-line text-ink hover:bg-line-soft -ml-px w-11 shrink-0 border text-[13px] transition-colors"
      >
        <span aria-hidden>⌕</span>
      </button>
    </form>
  )
}
