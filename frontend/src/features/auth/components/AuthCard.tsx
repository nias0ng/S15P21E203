import { cn } from '@/shared/lib/cn'
import { PANEL } from '@/shared/ui/panel'

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
 * 와이어프레임 규격: 폭 340px, 내부 여백 20px, 요소 간격 12px.
 *
 * 바탕색(surface-card)은 그대로입니다. 각진 테두리 상자를 다른 화면과 같은 판
 * (둥근 모서리 · 옅은 그림자 · 흐린 테두리)으로 바꿨습니다. 종이 위에서 색만
 * 밝아서는 덜 떠 보입니다 — 모서리와 그림자가 있어야 얹힌 것으로 읽힙니다.
 * 여백은 와이어프레임 규격 20px 를 지키느라 판 기본값(24px)을 덮어씁니다.
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
    <div className={cn('w-full max-w-85 space-y-1.5', className)}>
      <div className={cn(PANEL, 'space-y-3 p-5')}>
        {eyebrow && <p className="text-ink-muted text-[10.5px]">{eyebrow}</p>}
        <h1 className="text-ink text-[17px] font-bold">{title}</h1>
        {description && <p className="text-ink text-xs">{description}</p>}
        {children}
      </div>

      {notes?.map((note) => (
        <p key={note} className="text-ink-muted text-[10.5px] leading-relaxed">
          {note}
        </p>
      ))}
    </div>
  )
}
