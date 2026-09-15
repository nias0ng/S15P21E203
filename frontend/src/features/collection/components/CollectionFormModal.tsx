import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import type { CollectionInput } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (input: CollectionInput) => void
  /** 값이 있으면 수정(COL-05), 없으면 만들기(COL-01) 입니다. */
  initial?: CollectionInput
}

/**
 * 컬렉션 만들기 · 수정 모달 (와이어프레임 A19 좌 · 중 — COL-01 · COL-05)
 *
 * 와이어프레임 주석:
 * - 공개 · 비공개 상태가 없다 — 남에게 보이는 건 자유 게시판의 컬렉션 공유 글로만
 * - 향수 없이도 생성 가능
 * - 수정은 제목 · 설명만 — 구성 향수는 A17 에서 고친다
 *
 * 두 모달의 내용이 같아 하나로 만들고 제목과 버튼 문구만 바꿉니다.
 */
export function CollectionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: Props) {
  const editing = initial !== undefined
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '컬렉션 수정' : '컬렉션 만들기'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            // 제목은 필수입니다
            disabled={title.trim().length === 0}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim() || null,
              })
            }
          >
            {editing ? '저장' : '만들기'}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Input
          label="제목"
          hideLabel
          placeholder="제목 *"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          label="설명"
          hideLabel
          placeholder="설명 (선택)"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {editing ? (
          <p className="text-ink-muted text-caption leading-relaxed">
            제목 · 설명만 수정합니다. 구성 향수는 컬렉션 상세에서 고칩니다.
          </p>
        ) : (
          <p className="text-ink-muted text-caption leading-relaxed">
            공개 · 비공개 상태가 없습니다. 남에게 보이는 길은 자유 게시판의
            컬렉션 공유 글뿐입니다. 향수 없이도 만들 수 있습니다.
          </p>
        )}
      </div>
    </Modal>
  )
}
