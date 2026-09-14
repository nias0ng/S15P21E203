import { cn } from '@/shared/lib/cn'
import { SearchIcon } from '@/shared/ui/SearchIcon'

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
 * 검색 입력 + [검색] 버튼 (와이어프레임 A33 · A09 · A34 · A35 · C02 공용)
 *
 * 헤더에 검색창이 없어 목록 화면마다 반복되므로 shared 에 둡니다.
 * 버튼이 아이콘이 아니라 "검색" 글자인 이유: 옆의 돋보기 장식과 구분이 안 됩니다.
 * 폭은 호출하는 쪽이 정합니다 — 목록과 모달에서 필요한 폭이 다릅니다.
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
      className={cn(
        'border-line/60 bg-surface-veil-strong rounded-panel flex items-stretch overflow-hidden border',
        // 포커스 링을 판 전체에 겁니다 — 입력창에 걸면 둥근 모서리와 겹칩니다
        'focus-within:ring-accent-deep focus-within:ring-2',
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        onSearch?.(String(data.get(name) ?? ''))
      }}
    >
      <label className="sr-only" htmlFor={`search-${name}`}>
        {label}
      </label>

      <span className="text-ink-muted flex shrink-0 items-center pl-4">
        <SearchIcon />
      </span>

      <input
        id={`search-${name}`}
        name={name}
        type="search"
        className={cn(
          'text-ink placeholder:text-ink-muted text-body min-w-0 flex-1 bg-transparent px-3 py-3.5',
          // 링은 위 form 이 그립니다
          'border-0 outline-none',
          // 크롬의 기본 지우기 버튼. [검색] 버튼과 붙어 있으면 헷갈립니다
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...props}
      />

      <button
        type="submit"
        className={cn(
          'bg-accent-warm text-surface-card text-body shrink-0 px-8',
          'transition-opacity duration-120 ease-out hover:opacity-90',
        )}
      >
        검색
      </button>
    </form>
  )
}
