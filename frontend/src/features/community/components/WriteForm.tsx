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
 * 글쓰기 화면 껍데기 (와이어프레임 A24a · A24b 공용)
 *
 * 후기 쓰기와 자유 글쓰기는 **가운데 입력 항목만 다르고 나머지가 같습니다** —
 * 제목 · 설명 · 취소/포스팅 줄. 나눠 두면 한쪽만 고쳐집니다.
 *
 * ── 폭을 text(800px)로 좁힌 이유 ──────────────────────────
 * 글을 쓰는 화면입니다. 1440px 짜리 입력칸은 한 줄이 100자를 넘어가서, 방금 친 글을
 * 다시 읽기가 어렵습니다. 읽는 화면(게시글 상세)과 같은 폭이라 쓰고 나서 보이는
 * 모습도 예상대로입니다.
 *
 * ── 규칙 문구를 위로 올린 이유 ────────────────────────────
 * 예전에는 "분류는 필수입니다..." 가 [포스팅] 단추 **아래**에 있었습니다. 규칙을
 * 다 쓰고 난 뒤에 읽게 되는 자리라, 필수 항목을 빠뜨린 사람은 단추가 왜 꺼져 있는지
 * 모른 채 화면을 뒤지게 됩니다.
 *
 * ── 어두운 방 위의 유리판 ─────────────────────────────────
 * 게시판(A22a · A22b)에서 [글쓰기] 한 번으로 오는 화면이라 같은 어둠을 씁니다
 * (라우트의 `handle.night`). **제목 묶음은 어둠에 바로, 입력 항목은 판 위에** —
 * 글 상세(A23)의 머리 구역과 본문 판이 나뉘는 자리와 같습니다. 입력칸은 판 위에서
 * 파인 자리(검정 0.22)로 앉아 판과 구분됩니다(styles/scent-display.css).
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

/**
 * 이미지 첨부 칸 (A24a · A24b 공용)
 *
 * ⚠️ 아직 업로드를 붙이지 않았습니다. 자리와 규칙만 잡아 둡니다.
 */
export function ImageAttachField() {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-ink text-caption font-medium">
        이미지 첨부 <span className="text-ink-muted">(선택)</span>
      </legend>
      {/* TODO: 이미지 업로드 연결 (형식 · 용량 제한은 별도 정책) */}
      <Button variant="outline" size="sm" type="button">
        + 이미지 첨부
      </Button>
    </fieldset>
  )
}
