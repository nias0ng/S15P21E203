import { cva } from 'class-variance-authority'

import { FOCUS_RING } from './focusRing'

/**
 * 버튼 스타일 정의. Button 과 LinkButton 이 공유합니다 — 컴포넌트 파일과 함께
 * export 하면 Fast Refresh 가 깨지고 lint 도 실패합니다.
 *
 * 포커스 링이 accent-deep 인 이유: accent 는 ivory 위 2.90:1 이라 기준(3:1)에 못
 * 미칩니다. 비활성은 **테두리만 남깁니다**(A32 확정).
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2.5 rounded-card font-medium ' +
    'transition-colors duration-120 ease-out ' +
    FOCUS_RING +
    ' disabled:pointer-events-none disabled:border disabled:border-line ' +
    'disabled:bg-transparent disabled:text-ink-muted disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-surface hover:bg-ink-muted',
        secondary: 'bg-line-soft text-ink hover:bg-line',
        outline:
          'border border-line bg-transparent text-ink hover:bg-line-soft',
        ghost:
          'bg-transparent text-ink-muted hover:bg-line-soft hover:text-ink',
        danger: 'bg-danger text-surface hover:bg-danger/90',
      },
      size: {
        /*
         * `sm` 만 바닥을 깝니다. 높이는 `--spacing` 을 타 1536 에서 30 → 24 로 줄지만
         * 글자는 13px 그대로(줄상자 22.1px)라 위아래 여유가 0.95px 씩밖에 안 남습니다 —
         * 잘리지는 않아도 글자가 테두리에 닿습니다. 바닥을 활자 스케일에서 끌어내
         * **글자가 줄면 바닥도 따라 내려가게** 합니다. 1920 에서는 30 이 더 커서 무시됩니다.
         */
        sm: 'text-body h-7.5 min-h-[calc(var(--text-body)*var(--text-body--line-height)+5px)] px-2.5',
        md: 'text-body h-10 px-3.75',
        lg: 'text-body h-12.5 px-6.25',
        icon: 'size-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)
