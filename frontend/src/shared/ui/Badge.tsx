import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'

/**
 * 향 계열 · 노트 · 상태처럼 짧은 라벨.
 *
 * tone 은 색 이름이 아니라 뜻입니다. 팔레트가 또 바뀌어도 호출부를 고치지
 * 않으려는 것입니다. 강조 tone 은 화면을 채우지 말고 필요한 지점에만 씁니다.
 * 색으로 뜻을 구분할 때는 라벨 글자도 함께 달아야 합니다(색만으로 구분 금지).
 */
const badgeVariants = cva(
  'text-caption inline-flex items-center rounded-full px-3 py-1 font-medium',
  {
    variants: {
      tone: {
        /** 기본 — 뉴트럴. 대부분은 이걸 씁니다 */
        neutral: 'bg-line-soft text-ink-muted',
        /** 진열대 분류 · 보유 상태처럼 브랜드 강조가 필요한 라벨 */
        accent: 'border-accent-deep text-accent-deep border bg-transparent',
        /** 저장 완료 */
        success: 'border-success text-success border bg-transparent',
        /** 검수 보류 · 삭제 예정 */
        danger: 'border-danger text-danger border bg-transparent',
        /** 테두리만 — 카드 위에 여러 개 나열할 때 */
        outline: 'border-line border bg-transparent text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type BadgeProps = React.ComponentPropsWithRef<'span'> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
