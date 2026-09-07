import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import type { ModerationRejection } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  rejection: ModerationRejection | null
}

/**
 * 수정 요청 모달 (와이어프레임 A25 — CMT-13)
 *
 * 포스팅할 때 정책 검수를 통과하지 못하면 뜹니다.
 *
 * 와이어프레임 주석 두 가지가 중요합니다.
 * - 작성한 제목과 본문은 유지된다 — 다시 쓰게 만들지 않는다.
 *   그래서 [수정하기]는 작성 화면으로 돌아가기만 하고 폼을 비우지 않습니다.
 * - 필터링 대상은 제목과 본문으로 한정 · 수정 시에도 동일 검사
 */
export function ModerationRejectedModal({ open, onClose, rejection }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="게시를 보류했습니다"
      footer={<Button onClick={onClose}>수정하기</Button>}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-ink-muted text-[10.5px]">사유</p>
          <ul className="border-line space-y-1 border p-3">
            {(rejection?.reasons ?? []).map((reason) => (
              <li key={reason} className="text-ink text-xs">
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <p className="text-ink-muted text-[10.5px]">수정 요청 내용</p>
          <p className="border-line text-ink border p-3 text-xs leading-relaxed">
            {rejection?.requestedChange}
          </p>
        </div>

        <p className="text-ink-muted text-[10.5px] leading-relaxed">
          작성한 제목과 본문은 그대로 남아 있습니다. 내용을 고쳐 다시 포스팅하면
          같은 검사를 다시 수행합니다.
        </p>
      </div>
    </Modal>
  )
}
