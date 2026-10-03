import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { FOCUS_RING } from './focusRing'

type SearchFieldProps = Omit<
  React.ComponentPropsWithRef<'input'>,
  'type' | 'id'
> & {
  label: string
  onSearch?: (keyword: string) => void

  // NOTE: 여기 넣는 단추는 `type="button"` 이어야 합니다 — form 안이라 기본값 (`submit`)이면 누를 때마다 검색이 실행됩니다.
  leading?: React.ReactNode
  tone?: SearchFieldTone
  className?: string
}

type SearchFieldTone = 'archive' | 'scene'

const SUBMIT_TONE: Record<SearchFieldTone, string> = {
  archive: 'bg-accent-deep',
  scene: 'from-scene-send to-scene-send-deep bg-gradient-to-br',
}

/**
 * NOTE: `scene` 의 알약은 목록(56)보다 낮은 50 이라, 두 방이 같은 42 를 쓰면 메인에서만
 * 위아래 숨이 4 밖에 안 남아 단추가 알약을 꽉 채웁니다. 알약이 42 · 40 으로 줄어드는
 * 좁은 창에서는 아예 같은 높이가 됩니다 — 그래서 단계마다 같이 줄입니다.
 */
const SUBMIT_SIZE: Record<SearchFieldTone, string> = {
  archive: 'size-10.5',
  scene: 'size-8.75 max-[760px]:size-7.5 [@media(max-height:560px)]:size-7.5',
}

// NOTE: 모달에는 쓰지 마세요 — 모달 폭이 510 이라 아무 일도 하지 않고, 모달이 넓어지면 검색창만 안 따라와 어긋납니다
export const SEARCH_FIELD_LIST_WIDTH = 'mx-auto w-full max-w-135'

// NOTE: 3D 안의 검색창은 엔진(`landing/index.html`)이 같은 모양을 따로 들고 있습니다
// — 순수 JS 라 이 컴포넌트를 못 씁니다. `scene` 을 고치면 엔진 쪽도 같이 고칩니다.
export function SearchField({
  label,
  onSearch,
  leading,
  tone = 'archive',
  className,
  name = 'keyword',
  // NOTE: 브라우저가 기억한 지난 검색어 목록을 끕니다.
  autoComplete = 'off',
  ...props
}: SearchFieldProps) {
  const { t } = useTranslation()

  return (
    <form
      role="search"
      className={cn(
        'relative isolate flex h-14 items-center gap-2.5 rounded-full pr-1.75 pl-5',
        // NOTE: 색을 의미 토큰이 아니라 팔레트에서 직접 가져옵니다
        // NOTE: `--search-*` 는 **어두운 방만 채웁니다**(`styles/scent-display.css`).
        'border-[var(--search-pill-edge,var(--color-stonegray))]',
        'border bg-[var(--search-pill,rgb(249_246_239/0.9))] backdrop-blur-[7px]',
        'shadow-[0_10px_30px_rgb(24_18_34/0.2)]',
        'before:pointer-events-none before:absolute before:-inset-x-6 before:-inset-y-4',
        'before:-z-10 before:rounded-full before:blur-xl',
        'before:bg-[radial-gradient(ellipse_at_center,var(--search-glow,transparent),transparent_70%)]',
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
        autoComplete={autoComplete}
        className={cn(
          'text-charcoal placeholder:text-charcoal-soft text-body h-full min-w-0 flex-1',
          'bg-transparent outline-none',
        )}
        {...props}
      />

      <button
        type="submit"
        aria-label={t('actions.search')}
        className={cn(
          'relative grid shrink-0 place-items-center rounded-full',
          SUBMIT_SIZE[tone],
          'text-[var(--search-submit-ink,var(--color-ivory))]',
          tone === 'archive'
            ? cn(
                'bg-[var(--search-submit,var(--color-accent-deep))]',
                'bg-[image:var(--search-submit-image,none)]',
              )
            : SUBMIT_TONE[tone],
          'shadow-[0_2px_8px_rgb(24_18_34/0.18)]',
          tone === 'archive' &&
            'hover:brightness-[var(--search-submit-hover,1.15)]',
          'transition-[transform,filter] duration-120 ease-out active:scale-95',
          FOCUS_RING,
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
