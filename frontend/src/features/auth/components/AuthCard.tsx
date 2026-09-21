import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

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
 *
 * 향수 · 브랜드 · 노트와 같은 **어두운 방 위의 유리판**입니다 — 생김새를 여기서 따로
 * 정하지 않고 `GLASS_PANEL` 을 그대로 씁니다. ⚠️ 이 카드를 쓰는 화면은 라우트에
 * `night` 이 켜져 있어야 합니다(`app/router`). 밝은 화면에 두면 판 위 기준으로 맞춘
 * 글자색(`--color-ink-muted` 가 `#d8d2c9`)이 상아색 바탕에 얹혀 안 읽힙니다.
 *
 * 폭은 **세 화면이 같습니다**(420px). 와이어프레임은 340px 이었지만 회원가입만 넓혀
 * 두니, 로그인에서 회원가입으로 넘어갈 때 판이 한 번 커졌습니다.
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
      className={cn(GLASS_PANEL, 'w-full max-w-105 space-y-3.75', className)}
    >
      {eyebrow && <p className="text-ink-muted text-caption">{eyebrow}</p>}
      <h1 className="text-ink text-title font-serif font-bold">{title}</h1>
      {description && <p className="text-ink-muted text-body">{description}</p>}
      {children}
    </div>
  )
}
