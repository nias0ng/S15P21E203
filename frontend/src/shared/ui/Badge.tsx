import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'

/**
 * 향 계열 · 노트 · 상태처럼 짧은 라벨.
 *
 * tone 은 시그니처 오팔 스펙트럼입니다. 팔레트 규칙이 "PEARL 5~10% MAX" 이므로
 * 화면을 색으로 채우지 말고 강조가 필요한 지점에만 씁니다.
 * 색으로 뜻을 구분할 때는 라벨 글자도 함께 달아야 합니다(색만으로 구분 금지).
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-ink',
  {
    variants: {
      tone: {
        /** 기본 — 뉴트럴. 대부분은 이걸 씁니다 */
        neutral: 'bg-line-soft text-ink-muted',
        vapor: 'bg-vapor',
        iris: 'bg-iris',
        coral: 'bg-coral',
        seaglass: 'bg-seaglass',
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
