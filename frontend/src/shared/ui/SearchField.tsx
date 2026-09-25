import { cn } from '@/shared/lib/cn'

import { FOCUS_RING } from './focusRing'

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
 *
 * NOTE: `scene` 의 두 색은 밝아서 아이보리 화살표가 1.67:1 · 1.94:1 입니다 — 그림 요소
 * 기준(3:1)에 못 미칩니다. 3D 바다 위라 알약이 바탕에서 이미 떠 있고, 화살표보다 단추의
 * 둥근 면이 '누를 것' 을 말하는 자리라 색을 살렸습니다.
 */
const SUBMIT_TONE: Record<SearchFieldTone, string> = {
  archive: 'bg-accent-deep',
  scene: 'from-scene-send to-scene-send-deep bg-gradient-to-br',
}

/**
 * 실행 단추의 지름. 알약 높이에 맞춰 갈립니다.
 *
 * NOTE: 아래 수치는 모두 **1920 기준**입니다 — 치수 유틸리티가 `--spacing` 을 타
 * 1536 에서 80%(56 → 44.8 · 50 → 40 · 42 → 33.6)까지 줄어든 뒤 멈춥니다. 그 구간에서는
 * 알약과 단추가 같은 비율로 줄어 둘의 짝이 그대로입니다 — 아래 NOTE 가 말하는 **단계**
 * (`SceneSearchBar` 의 `SIZE`)에서는 알약만 갈아타므로 비가 움직입니다. `scene` 의 50 도
 * 이 파일이 아니라 거기 있습니다.
 *
 * NOTE: `scene` 의 알약은 목록(56)보다 낮은 50 이라, 두 방이 같은 42 를 쓰면 메인에서만
 * 위아래 숨이 4 밖에 안 남아 단추가 알약을 꽉 채웁니다. 알약이 42 · 40 으로 줄어드는
 * 좁은 창에서는 아예 같은 높이가 됩니다 — 그래서 단계마다 같이 줄입니다.
 */
const SUBMIT_SIZE: Record<SearchFieldTone, string> = {
  archive: 'size-10.5',
  scene: 'size-8.75 max-[760px]:size-7.5 [@media(max-height:560px)]:size-7.5',
}

/**
 * 목록 화면(향수 · 브랜드 · 노트)의 검색창 폭과 가운데 놓기. 세 화면이 같이 써야
 * 화면을 오갈 때 검색창이 안 움직입니다.
 *
 * NOTE: 모달에는 쓰지 마세요 — 모달 폭이 510 이라 아무 일도 하지 않고, 모달이
 * 넓어지면 검색창만 안 따라와 어긋납니다.
 */
export const SEARCH_FIELD_LIST_WIDTH = 'mx-auto w-full max-w-135'

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
  /*
   * NOTE: 브라우저가 기억한 지난 검색어 목록을 끕니다. 검색창이 모두 같은 `name` 이라
   * 켜 두면 한 칸에 친 말이 다른 화면 · 모달의 검색창에서 그대로 떠오르고, 그 목록에
   * 마우스를 올리면 브라우저가 값을 미리 채우며 입력칸에 제 강조 바탕을 칠합니다.
   */
  autoComplete = 'off',
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
        /*
          NOTE: 포커스 링을 일부러 안 답니다. 칸을 누르면 글쇠로 온 것이 아니어도 링이 떠,
          짙은 청동이 모래빛 알약 · 상아색 종이 어느 쪽과도 따로 놉니다. 자리를 알리는 것은
          입력 커서뿐입니다 (`Input` · `Textarea` 와 같습니다).
        */
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
        aria-label="검색"
        className={cn(
          /* `relative` 는 빛무리(`-z-10`) 위에 확실히 세우려는 것입니다 */
          'relative grid shrink-0 place-items-center rounded-full',
          SUBMIT_SIZE[tone],
          'text-[var(--search-submit-ink,var(--color-ivory))]',
          tone === 'archive'
            ? cn(
                'bg-[var(--search-submit,var(--color-accent-deep))]',
                /* 그림 겹은 바탕색 위에 얹힙니다 — 방 밖에서는 비어 있어 바탕색만 섭니다 */
                'bg-[image:var(--search-submit-image,none)]',
              )
            : SUBMIT_TONE[tone],
          'shadow-[0_2px_8px_rgb(24_18_34/0.18)]',
          /*
           * 손을 올리면 단추만 한 단 밝아집니다. **메인(`scene`)은 빼 둡니다** —
           * 거기 단추는 이미 모래빛이라 더 밝히면 알약에 녹고, 3D 안의 엔진이 같은
           * 검색창을 따로 그리고 있어 둘이 어긋납니다(위 컴포넌트 머리말).
           *
           * 색이 아니라 `brightness` 인 까닭: 이 단추의 바탕을 정하는 것은 **방**입니다
           * (어두운 방은 남색 그라데이션 · 아이보리 모달은 짙은 청동). 호버 색을 박으면
           * 방마다 짝을 하나씩 더 들고 있어야 하는데, 밝기는 어느 바탕에서든 한 뜻입니다.
           *
           * ⚠️ **한 값으로는 안 됩니다** — 올릴 수 있는 천장이 방마다 다릅니다. 화살표는
           * 어디서나 아이보리라, 바탕을 밝힐수록 그림 요소 기준(3:1)에 가까워집니다.
           *
           *   아이보리 모달 · 진열대 종이 : 짙은 청동(#7f6f4d) 4.54:1 → 1.15 에서 3.57:1.
           *     1.25 면 3.07:1 이라 기준에 닿습니다. 그래서 **기본값이 1.15** 입니다.
           *   어두운 방 : 남색이 깊어 여유가 큽니다 — 방이 `--search-submit-hover` 로
           *     따로 올립니다(`styles/scent-display.css`). 1.15 로는 눈에 안 띕니다.
           *
           * 기본값을 여기 뒤에 두는 것은 나머지 `--search-*` 와 같습니다 — 방이 안
           * 채우면 이 값이 섭니다.
           */
          tone === 'archive' &&
            'hover:brightness-[var(--search-submit-hover,1.15)]',
          /* 밝아지는 것도 눌리는 것과 같은 속도로 — `filter` 를 빼면 호버가 딱딱 끊깁니다 */
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
