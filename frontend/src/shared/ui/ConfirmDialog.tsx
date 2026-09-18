import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** 기본값은 와이어프레임 C01 문구입니다. 대상 이름을 넣으려면 넘겨주세요. */
  title?: string
  description?: string
  confirmLabel?: string
  /** 되돌릴 수 없는 동작이면 true (기본). false 면 확인 버튼이 primary 로 바뀝니다. */
  destructive?: boolean
  isLoading?: boolean
}

/**
 * 삭제 확인 모달 (와이어프레임 C01 — 7곳 공용)
 *
 * ⚠️ 대상 이름을 문구에 넣을지는 팀 확정 전입니다. prop 으로 열어두고 기본값만
 * 채웠으니, 정해지면 기본값을 바꾸거나 호출부에서 넘기면 됩니다.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = '삭제할까요?',
  description = '삭제하면 되돌릴 수 없습니다.',
  confirmLabel = '삭제',
  destructive = true,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      /*
        확인 · 경고는 읽고 [예 · 아니오] 만 고르는 모달이라 안내 모양으로 둡니다 —
        글이 가운데로 모이고, 단추 위 선이 없고, 문장 위아래가 넓습니다. 칸이 없어
        왼쪽에서 시작할 것이 없고 문장도 두세 줄뿐입니다.

        단추는 오른쪽 그대로입니다 — 이 서비스의 모든 모달이 [취소]와 확인 단추를
        오른쪽 아래에 두고 있어, 여기만 옮기면 손이 가는 자리가 달라집니다.
      */
      notice
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/*
        본문(13px)이 아니라 소제목 크기(16px)입니다. 이 한 문장이 **무엇을 되돌릴 수
        없는지** 를 말하는 유일한 자리라, 지우기 전에 반드시 읽혀야 합니다. 목록의
        본문처럼 여러 줄을 읽어 내려가는 글이 아니라 두 줄짜리 경고여서, 한 단 키워도
        화면이 시끄러워지지 않습니다. 활자 스케일의 `heading` 이고 임의값이 아닙니다.
      */}
      <p className="text-ink text-heading text-center">{description}</p>
    </Modal>
  )
}
