import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'
import { GLASS_PANEL } from '@/shared/ui/panel'

type Props = {
  title: string
  /** 이 게시판의 규칙을 한 줄로. 예전에는 이 내용이 단추 아래에 있었습니다 */
  description: string
  /** 취소했을 때 돌아갈 곳 */
  cancelTo: string
  submitLabel: string
  submitDisabled: boolean
  onSubmit: () => void
  children: React.ReactNode
}

/**
 * 글쓰기 화면 껍데기 (A24a · A24b 공용)
 *
 * 후기 쓰기와 자유 글쓰기는 **가운데 입력 항목만 다르고 나머지가 같습니다** —
 * 나눠 두면 한쪽만 고쳐집니다.
 *
 * 규칙 문구는 [포스팅] **위**입니다. 아래에 있던 때, 필수 항목을 빠뜨린 사람은
 * 단추가 왜 꺼져 있는지 모른 채 화면을 뒤졌습니다.
 *
 * 어두운 방 · 유리판 구성 — docs/어두운-방-유리판.md
 */
export function WriteForm({
  title,
  description,
  cancelTo,
  submitLabel,
  submitDisabled,
  onSubmit,
  children,
}: Props) {
  return (
    // 폭은 글쓰기 화면의 라우트(TEXT_NIGHT, 800)가 정합니다 — 글 읽는 화면과 같은 폭
    <div className="space-y-6.25">
      <header className="space-y-2.5">
        <h1 className="text-ink text-display font-serif font-bold">{title}</h1>
        <p className="text-ink-muted text-body">{description}</p>
      </header>

      <form
        className={cn(GLASS_PANEL, 'space-y-6.25')}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}

        {/*
          단추 줄을 선으로 떼어 놓습니다. 붙여 두면 마지막 입력 항목의 일부처럼
          보여서, 이미지 첨부 단추와 포스팅 단추가 같은 무게로 읽힙니다.
        */}
        <div className="border-line flex justify-end gap-2.5 border-t pt-6.25">
          <LinkButton to={cancelTo} variant="outline">
            취소
          </LinkButton>
          <Button type="submit" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
