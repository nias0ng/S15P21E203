import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

type AuthCardProps = {
  title: string
  description?: string
  /** 큰 판(로그인 · 회원가입). 치수와 글자가 함께 한 단계 커집니다 */
  large?: boolean
  children?: React.ReactNode
}

// NOTE: 라우트에 `night` 이 없으면 판 위 기준으로 맞춘 글자색이 상아색 바탕에 얹혀 안 읽힙니다(`app/router`).
export function AuthCard({
  title,
  description,
  large = false,
  children,
}: AuthCardProps) {
  return (
    <div
      className={cn(
        GLASS_PANEL,
        'rounded-card w-full max-w-105 space-y-3.75',
        // 기준자가 1.5배라 같은 105 면 630 까지 벌어집니다. 칸은 키우고 폭은 조금 덜 벌립니다
        large && 'auth-card-large max-w-95',
      )}
    >
      <h1 className="text-ink text-title font-serif font-bold">{title}</h1>
      {description && <p className="text-ink-muted text-body">{description}</p>}
      {children}
    </div>
  )
}
