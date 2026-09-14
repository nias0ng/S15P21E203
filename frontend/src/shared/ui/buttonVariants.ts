import { cva } from 'class-variance-authority'

/**
 * 버튼 스타일 정의. Button 과 LinkButton 이 공유합니다.
 *
 * 컴포넌트 파일과 분리한 이유: 컴포넌트가 아닌 것을 함께 export 하면 Fast Refresh 가
 * 깨지고 lint 도 실패합니다.
 *
 * 포커스 링이 accent 가 아니라 accent-deep 인 이유: accent 는 ivory 위 2.90:1 이라
 * 포커스 표시 기준(3:1)에 못 미칩니다.
 * 비활성은 **테두리만 남깁니다**(A32 확정).
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-card font-medium ' +
    'transition-colors duration-120 ease-out outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:border disabled:border-line ' +
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
        sm: 'text-body h-8 px-3',
        md: 'text-body h-10 px-4',
        lg: 'text-body h-12 px-6',
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
