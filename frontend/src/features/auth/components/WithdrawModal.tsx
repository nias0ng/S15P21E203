import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Modal } from '@/shared/ui/Modal'

type Props = { open: boolean; onClose: () => void }

/**
 * 회원 탈퇴 모달 (와이어프레임 A30 우측 — A29 [회원 탈퇴] 도착 · COM-06)
 *
 * 와이어프레임에 남은 확정 필요 항목 두 가지를 화면에 그대로 적어둡니다.
 * - 삭제 범위 · 보관 기간 · 커뮤니티 게시글 처리는 팀 확정 필요
 * - 비밀번호 재확인을 넣을지 확인 필요
 */
export function WithdrawModal({ open, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="회원 탈퇴"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            // 안내를 확인해야만 탈퇴할 수 있습니다
            disabled={!confirmed}
            onClick={() => {
              // TODO: 회원 탈퇴 API 연결
            }}
          >
            탈퇴
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="border-line bg-line-soft text-ink border p-3 text-[11px]">
          진열대 · 컬렉션 · 메모 · 후기 · 향 이미지가 함께 삭제됩니다
        </p>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="text-ink text-xs">위 내용을 확인했습니다</span>
        </label>

        <div className="text-ink-muted space-y-0.5 text-[10.5px] leading-relaxed">
          <p>삭제 범위 · 보관 기간 · 커뮤니티 게시글 처리는 팀 확정 필요</p>
          <p>비밀번호 재확인을 넣을지 확인 필요</p>
        </div>
      </div>
    </Modal>
  )
}
