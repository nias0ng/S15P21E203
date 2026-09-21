import { cn } from '@/shared/lib/cn'

type AuthCardProps = {
  title: string
  /** 카드 위에 붙는 작은 안내 (와이어프레임 A31 의 "찾기", "재설정 (메일 링크 진입)") */
  eyebrow?: string
  /** 제목 아래 설명 한 줄 */
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * 인증 화면 공통 카드 (와이어프레임 A28 · A31)
 * 와이어프레임 규격: 폭 340px, 1px 테두리, 내부 여백 20px, 요소 간격 12px.
 */
export function AuthCard({
  title,
  eyebrow,
  description,
  children,
  className,
}: AuthCardProps) {
  return (
    <div
      className={cn(
        'border-line bg-surface-card w-full max-w-85 space-y-2.5 border p-5',
        className,
      )}
    >
      {eyebrow && <p className="text-ink-muted text-[10.5px]">{eyebrow}</p>}
      <h1 className="text-ink text-[17px] font-bold">{title}</h1>
      {description && <p className="text-ink text-xs">{description}</p>}
      {children}
    </div>
  )
}
