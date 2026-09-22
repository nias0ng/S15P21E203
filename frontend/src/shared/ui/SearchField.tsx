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
 * NOTE: `archive` 의 색은 **방이 정합니다** — 어두운 방이 `--search-submit` ·
 * `--search-submit-image` 를 채워 남색 그라데이션이 되고(`styles/scent-display.css`),
 * 아이보리 모달 · 진열대 종이에서는 둘 다 비어 있어 아래 짙은 청동이 섭니다.
 * 짙은 청동인 까닭은 대비입니다 — 옅은 청동(`accent`) 위의 아이보리 화살표는
 * 2.90:1 로 기준(3:1)에 못 미치고 `accent-deep` 이라야 4.54:1 입니다.
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
        /* `isolate` 는 아래 빛무리(`-z-10`)를 이 알약 안에 가둡니다 — 없으면 조상 쌓임 맥락에 따라 뒤로 빠져 안 보일 수 있습니다 */
        'relative isolate flex h-14 items-center gap-2.5 rounded-full pr-1.75 pl-5',
        /*
          NOTE: 색을 의미 토큰이 아니라 팔레트에서 직접 가져옵니다 — 토큰을 쓰면
          어두운 방에서 같이 뒤집혀 검색창이 바탕에 녹습니다.

          NOTE: `--search-*` 는 **어두운 방만 채웁니다**(`styles/scent-display.css`).
          채워지지 않은 곳(아이보리 모달 · 진열대 종이)은 뒤의 기본값이 섭니다.
        */
        'border-[var(--search-pill-edge,var(--color-stonegray))]',
        'border bg-[var(--search-pill,rgb(249_246_239/0.9))] backdrop-blur-[7px]',
        'shadow-[0_10px_30px_rgb(24_18_34/0.2)]',
        /*
          빛무리. `-z-10` 이라 알약 뒤에 깔려, 단추를 포함한 모든 자식이 그 위에
          섭니다 — 알약 밖으로 번지도록 상자를 키우고 흐립니다.
        */
        'before:pointer-events-none before:absolute before:-inset-x-6 before:-inset-y-4',
        'before:-z-10 before:rounded-full before:blur-xl',
        'before:bg-[radial-gradient(ellipse_at_center,var(--search-glow,transparent),transparent_70%)]',
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
          /* `relative` 는 빛무리(`-z-10`) 위에 확실히 세우려는 것입니다 */
          'relative grid size-10.5 shrink-0 place-items-center rounded-full',
          'text-[var(--search-submit-ink,var(--color-ivory))]',
          tone === 'archive'
            ? cn(
                'bg-[var(--search-submit,var(--color-accent-deep))]',
                /* 그림 겹은 바탕색 위에 얹힙니다 — 방 밖에서는 비어 있어 바탕색만 섭니다 */
                'bg-[image:var(--search-submit-image,none)]',
              )
            : SUBMIT_TONE[tone],
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
