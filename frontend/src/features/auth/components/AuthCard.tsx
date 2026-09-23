import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

type AuthCardProps = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * 인증 화면 공통 카드. 생김새는 `GLASS_PANEL` 이고, 모서리만 안의 입력칸과 같은
 * `rounded-card` 로 맞춥니다 — 판만 둥글면 네모난 입력칸과 모양이 따로 놉니다.
 *
 * NOTE: 라우트에 `night` 이 없으면 판 위 기준으로 맞춘 글자색이 상아색 바탕에 얹혀
 * 안 읽힙니다(`app/router`).
 */
export function AuthCard({
  title,
  description,
  children,
  className,
}: AuthCardProps) {
  return (
    <div
      className={cn(
        GLASS_PANEL,
        'rounded-card w-full max-w-105 space-y-3.75',
        className,
      )}
    >
      <h1 className="text-ink text-title font-serif font-bold">{title}</h1>
      {description && <p className="text-ink-muted text-body">{description}</p>}
      {children}
    </div>
  )
}
