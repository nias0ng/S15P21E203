import { cva } from 'class-variance-authority'

/**
 * 버튼 스타일 정의. Button(버튼)과 LinkButton(링크) 둘이 공유합니다.
 *
 * 컴포넌트 파일과 분리한 이유는 react-refresh 규칙 때문입니다. 컴포넌트 파일이
 * 컴포넌트가 아닌 것을 함께 export 하면 Fast Refresh 가 깨지고 lint 도 실패합니다.
 *
 * 색은 Museum Archive 팔레트의 뉴트럴로 명도 대비만 써서 구분합니다.
 * primary 는 charcoal 바탕이고, danger 만 러스트를 씁니다.
 * 포커스 링은 accent-deep 입니다 — accent(bronze)는 ivory 위 2.90:1 이라
 * 포커스 표시 기준(3:1)에 못 미칩니다.
 *
 * 비활성 표현은 **테두리만 남기기로 확정**되었습니다(와이어프레임 A32).
 * 채움을 없애고 테두리와 흐린 글자만 남깁니다. disabled: 는 의사 클래스라
 * 우선순위가 높아서, variant 가 지정한 bg · text 를 덮습니다.
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
