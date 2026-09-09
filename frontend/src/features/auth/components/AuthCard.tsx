import { cn } from '@/shared/lib/cn'

type AuthCardProps = {
  title: string
  /** 카드 위에 붙는 작은 안내 (와이어프레임 A31 의 "찾기", "재설정 (메일 링크 진입)") */
  eyebrow?: string
  /** 제목 아래 설명 한 줄 */
  description?: string
  children: React.ReactNode
  /** 카드 아래 회색 주석 — 팀 확정이 필요한 항목을 화면에 남겨둡니다 */
  notes?: string[]
  className?: string
}

/**
 * 인증 화면 공통 카드 (와이어프레임 A28 · A31 · A32)
 * 와이어프레임 규격: 폭 340px, 1px 테두리, 내부 여백 20px, 요소 간격 12px.
 */
export function AuthCard({
  title,
  eyebrow,
  description,
  children,
  notes,
  className,
}: AuthCardProps) {
  return (
    <div className={cn('w-full max-w-85 space-y-2', className)}>
      <div className="border-line bg-surface-card space-y-3 border p-5">
        {eyebrow && <p className="text-ink-muted text-caption">{eyebrow}</p>}
        <h1 className="text-ink text-title font-serif font-semibold">
          {title}
        </h1>
        {description && <p className="text-ink text-body">{description}</p>}
        {children}
      </div>

      {notes?.map((note) => (
        <p key={note} className="text-ink-muted text-caption">
          {note}
        </p>
      ))}
    </div>
  )
}
