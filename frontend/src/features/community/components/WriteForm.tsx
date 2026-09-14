import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'

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
 * 후기와 자유 글은 가운데 입력 항목만 다릅니다. 나눠 두면 한쪽만 고쳐집니다.
 *
 * 폭이 46rem 인 이유: 1120px 입력칸은 한 줄이 100자를 넘어 방금 친 글을 다시 읽기
 * 어렵습니다. 읽는 화면(게시글 상세)과 같은 폭이라 결과도 예상대로입니다.
 * 규칙 문구가 단추 위인 이유: 아래 두면 단추가 왜 꺼져 있는지 모른 채 화면을 뒤집니다.
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
    <div className="mx-auto max-w-[46rem] space-y-8">
      <header className="space-y-2">
        <h1 className="text-ink text-display font-serif font-bold">{title}</h1>
        <p className="text-ink-muted text-body">{description}</p>
      </header>

      <form
        className="space-y-6"
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
        <div className="border-line flex justify-end gap-2 border-t pt-6">
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
    <fieldset className="space-y-2">
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
