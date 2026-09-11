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
 * 헤더에는 검색창이 없고 각 페이지 안에 있다는 와이어프레임 규칙 때문에
 * 목록 화면마다 같은 모양이 반복됩니다. 그래서 shared/ui 에 둡니다.
 *
 * ── 시안에서 바뀐 것 ────────────────────────────────────
 * 테두리 상자 두 개(입력창 + 정사각 버튼)가 나란히 서 있던 것을 **둥근 판 하나**로
 * 합쳤습니다. 돋보기는 버튼이 아니라 입력창 안 왼쪽 장식으로 들어가고, 오른쪽
 * 버튼에는 `⌕` 대신 "검색" 글자가 들어갑니다.
 *
 * 글자로 바꾼 이유: `⌕` 는 폰트에 따라 안 그려지거나 물음표로 나옵니다. 그리고
 * 아이콘만 있는 버튼은 옆의 돋보기 장식과 구분이 안 됩니다.
 *
 * 폭은 호출하는 쪽이 정합니다(`className`). 시안의 향수 목록은 본문 폭의 절반이고,
 * 모달 안에서는 꽉 채워야 해서 여기서 고정하면 둘 중 하나가 어긋납니다.
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
        // 포커스 링을 입력창이 아니라 판 전체에 겁니다. 입력창에 걸면 판 안쪽에
        // 링이 그려져 둥근 모서리와 겹칩니다.
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
          // 크롬이 type=search 에 붙이는 기본 지우기 버튼. 오른쪽 [검색] 버튼과
          // 붙어 있으면 무엇을 누르는지 헷갈립니다.
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
