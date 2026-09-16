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
 * 검색 입력 + [검색] (와이어프레임 A33 · A09 · A34 · A35 · C02 공용)
 *
 * 헤더에는 검색창이 없고 각 페이지 안에 있다는 와이어프레임 규칙 때문에
 * 목록 화면마다 같은 모양이 반복됩니다. 그래서 shared/ui 에 둡니다.
 *
 * **모양은 알약 한 덩이입니다** — 왼쪽에 돋보기, 가운데 입력, 오른쪽에 채운 [검색].
 * 예전에는 각진 네모 입력 + 각진 `⌕` 단추였는데, 단추에 글자가 없어 무엇을 하는
 * 것인지 그림만으로 읽어야 했고(낭독기에는 aria-label 이 있었지만 눈으로는 기호
 * 하나였습니다) 화면의 다른 둥근 요소들과 따로 놀았습니다.
 *
 * 폭은 정하지 않습니다. 목록 화면은 좁게 왼쪽에 두고 모달은 꽉 채우는 식으로
 * 자리마다 다릅니다 — 부르는 쪽이 `className` 으로 정합니다.
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

      {/*
        포커스 링을 input 이 아니라 이 껍데기에 겁니다. input 에 걸면 링이 돋보기를
        뺀 안쪽에만 그려져 알약 테두리와 따로 놉니다. 진열대 검색창과 같은 방법입니다.
      */}
      <div
        className={cn(
          'border-line bg-surface-card flex min-w-0 flex-1 items-center gap-2.5',
          'rounded-l-full border border-r-0 py-2.5 pr-2.5 pl-5',
          'has-[:focus-visible]:ring-accent-deep has-[:focus-visible]:ring-2',
        )}
      >
        <SearchIcon />
        <input
          id={`search-${name}`}
          name={name}
          type="search"
          className={cn(
            'text-ink placeholder:text-ink-muted text-body min-w-0 flex-1',
            // 알약이 바탕·테두리를 이미 그리고 있어 입력칸은 투명하게 얹습니다
            'bg-transparent outline-none',
          )}
          {...props}
        />
      </div>

      <button
        type="submit"
        className={cn(
          'bg-accent-deep text-surface text-body shrink-0 rounded-r-full px-7.5',
          'transition-opacity duration-120 ease-out hover:opacity-90',
          'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        )}
      >
        검색
      </button>
    </form>
  )
}

/**
 * 돋보기.
 *
 * 아이콘 하나 때문에 라이브러리를 붙이지 않습니다. currentColor 라 감싼 쪽의
 * 글자색을 그대로 따라갑니다.
 */
function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-ink-muted size-3.75 shrink-0"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}
