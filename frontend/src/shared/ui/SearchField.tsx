import { cn } from '@/shared/lib/cn'

type SearchFieldProps = Omit<
  React.ComponentPropsWithRef<'input'>,
  'type' | 'id'
> & {
  /** 화면에 보이지 않는 라벨. 무엇을 검색하는지 밝혀야 합니다 */
  label: string
  /** 검색 단추를 눌렀을 때. form 안이라 엔터로도 옵니다 */
  onSearch?: (keyword: string) => void
  /**
   * 입력칸 **왼쪽**에 놓을 것. 기본은 돋보기입니다.
   *
   * NOTE: 여기 넣는 단추는 `type="button"` 이어야 합니다 — form 안이라 기본값
   * (`submit`)이면 누를 때마다 검색이 실행됩니다.
   */
  leading?: React.ReactNode
  /** 실행 단추의 색. 메인(3D)만 `scene` 이고 나머지는 기본값입니다 */
  tone?: SearchFieldTone
  className?: string
}

type SearchFieldTone = 'archive' | 'scene'

/**
 * NOTE: `archive` 가 짙은 청동인 것은 대비 때문입니다 — 옅은 청동(`accent`) 위의
 * 아이보리 화살표는 2.90:1 로 기준(3:1)에 못 미치고, `accent-deep` 이라야 4.54:1 입니다.
 */
const SUBMIT_TONE: Record<SearchFieldTone, string> = {
  archive: 'bg-accent-deep',
  scene: 'from-glow to-accent bg-gradient-to-br',
}

/**
 * 목록 화면(향수 · 브랜드 · 노트)의 검색창 폭. 세 화면이 같이 써야 화면을 오갈 때
 * 검색창이 안 움직입니다.
 *
 * NOTE: 모달에는 쓰지 마세요 — 모달 폭이 510 이라 아무 일도 하지 않고, 모달이
 * 넓어지면 검색창만 안 따라와 어긋납니다.
 */
export const SEARCH_FIELD_LIST_WIDTH = 'max-w-[540px]'

/**
 * 검색 입력 + 둥근 보내기 단추 (A33 · A34 · A35 · C02 공용).
 * 알약은 어느 방에 있든 아이보리 종이 한 장이고 실행 단추만 `tone` 으로 갈립니다.
 *
 * NOTE: 3D 안의 검색창은 엔진(`landing/index.html`)이 같은 모양을 따로 들고 있습니다
 * — 순수 JS 라 이 컴포넌트를 못 씁니다. `scene` 을 고치면 엔진 쪽도 같이 고칩니다.
 */
export function SearchField({
  label,
  onSearch,
  leading,
  tone = 'archive',
  className,
  name = 'keyword',
  ...props
}: SearchFieldProps) {
  return (
    <form
      role="search"
      className={cn(
        'flex h-14 items-center gap-2.5 rounded-full pr-1.75 pl-5',
        /*
          NOTE: 색을 의미 토큰이 아니라 팔레트에서 직접 가져옵니다 — 토큰을 쓰면
          어두운 방에서 같이 뒤집혀 검색창이 바탕에 녹습니다.
        */
        'border-stonegray bg-ivory/90 border backdrop-blur-[7px]',
        'shadow-[0_10px_30px_rgb(24_18_34/0.2)]',
        /* 포커스 링은 input 이 아니라 알약에 겁니다 */
        'has-[:focus-visible]:ring-accent-deep has-[:focus-visible]:ring-2',
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

      {leading ?? <SearchIcon />}

      <input
        id={`search-${name}`}
        name={name}
        type="search"
        className={cn(
          'text-charcoal placeholder:text-charcoal-soft text-body h-full min-w-0 flex-1',
          'bg-transparent outline-none',
        )}
        {...props}
      />

      <button
        type="submit"
        aria-label="검색"
        className={cn(
          'grid size-10.5 shrink-0 place-items-center rounded-full',
          'text-ivory',
          SUBMIT_TONE[tone],
          'shadow-[0_2px_8px_rgb(24_18_34/0.18)]',
          'transition-transform duration-120 ease-out active:scale-95',
          'focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.75"
        >
          <path d="M4 12h15m0 0-6-6m6 6-6 6" />
        </svg>
      </button>
    </form>
  )
}

/** 돋보기 */
function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="text-charcoal-soft size-4.25 shrink-0"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
