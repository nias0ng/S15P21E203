import { cva } from 'class-variance-authority'

/**
 * 버튼 스타일 정의. Button(버튼)과 LinkButton(링크) 둘이 공유합니다.
 *
 * 컴포넌트 파일과 분리한 이유는 react-refresh 규칙 때문입니다. 컴포넌트 파일이
 * 컴포넌트가 아닌 것을 함께 export 하면 Fast Refresh 가 깨지고 lint 도 실패합니다.
 *
 * 색은 Scent Voyage 팔레트 규칙(NEUTRAL 90~95%)에 따라 명도 대비로만 구분합니다.
 * primary 는 Abyss 바탕이고, 오팔 색은 포커스 링에만 씁니다.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-card font-medium ' +
    'transition-colors outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-night',
        secondary: 'bg-line-soft text-ink hover:bg-fog',
        outline:
          'border border-line bg-transparent text-ink hover:bg-line-soft',
        ghost:
          'bg-transparent text-ink-muted hover:bg-line-soft hover:text-ink',
        danger: 'bg-coral text-ink hover:bg-coral/80',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
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
