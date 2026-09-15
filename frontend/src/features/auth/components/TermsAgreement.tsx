import { TERMS, type TermsState } from '@/features/auth/terms'
import { Checkbox } from '@/shared/ui/Checkbox'

type TermsAgreementProps = {
  value: TermsState
  onChange: (next: TermsState) => void
}

/**
 * 약관 동의 블록 (와이어프레임 A32 — 회원가입 하단에 붙는다)
 *
 * 와이어프레임 주석 두 가지를 그대로 남겨둡니다.
 * - 필수 미동의 시 [가입하기] 비활성 — 비활성 표현은 팀 확정 필요
 * - 약관 전문 화면은 별도 · 항목 구성은 법무 확인 필요
 */
export function TermsAgreement({ value, onChange }: TermsAgreementProps) {
  const allChecked = TERMS.every((term) => value[term.id])

  const toggleAll = (checked: boolean) => {
    onChange({ service: checked, privacy: checked, marketing: checked })
  }

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-ink text-[17px] font-bold">약관 동의</legend>

      {/* 전체 동의 — 테두리로 감싸 나머지 항목과 구분합니다 */}
      <label className="border-line flex cursor-pointer items-center gap-2.5 border px-2.5 py-2.5">
        <Checkbox
          checked={allChecked}
          onChange={(event) => toggleAll(event.target.checked)}
        />
        <span className="text-ink text-xs">전체 동의</span>
      </label>

      <ul className="space-y-2.5">
        {TERMS.map((term) => (
          <li key={term.id} className="flex items-center gap-2.5">
            <label className="flex flex-1 cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={value[term.id]}
                onChange={(event) =>
                  onChange({ ...value, [term.id]: event.target.checked })
                }
              />
              <span className="text-ink text-xs">{term.label}</span>
              <span className="text-ink-muted text-[10.5px]">
                ({term.required ? '필수' : '선택'})
              </span>
            </label>

            {/* 약관 전문 화면은 별도입니다. 준비되면 이 버튼에 링크를 연결합니다. */}
            {term.required && (
              <button
                type="button"
                className="border-line text-ink hover:bg-line-soft shrink-0 border px-2.5 py-1.25 text-[11px]"
              >
                보기
              </button>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
