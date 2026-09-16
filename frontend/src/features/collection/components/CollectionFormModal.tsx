import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import type {
  CollectionCandidate,
  CollectionCreateInput,
  CollectionInput,
} from '../types'

import { ShelfPerfumePicker } from './ShelfPerfumePicker'

/** 백엔드 검증 한도(`@Size`). 넘기면 400 이라 입력에서 먼저 막습니다 */
const TITLE_MAX = 50
const DESCRIPTION_MAX = 300

type Props = {
  open: boolean
  onClose: () => void
  isSubmitting?: boolean
} & (
  | {
      /** 만들기 (COL-01). 진열대 향수를 하나 이상 골라야 만들어집니다 */
      mode: 'create'
      candidates: CollectionCandidate[]
      onSubmit: (input: CollectionCreateInput) => void
    }
  | {
      /** 수정 (COL-05). 제목 · 설명만 — 구성 향수는 A17 에서 고칩니다 */
      mode: 'edit'
      initial: CollectionInput
      onSubmit: (input: CollectionInput) => void
    }
)

/**
 * 컬렉션 만들기 · 수정 모달 (와이어프레임 A19 좌 · 중 — COL-01 · COL-05)
 *
 * 와이어프레임 주석:
 * - 공개 · 비공개 상태가 없다 — 남에게 보이는 건 자유 게시판의 컬렉션 공유 글로만
 * - 수정은 제목 · 설명만 — 구성 향수는 A17 에서 고친다
 *
 * ⚠️ 와이어프레임의 "향수 없이도 생성 가능" 은 **따르지 않습니다.** 백엔드가 만들 때
 * 향수를 1개 이상 받고 마지막 향수도 못 빼게 막습니다(컬렉션은 늘 향수가 있다).
 * 그래서 만들기에는 진열대 향수 고르기가 붙고, 하나도 안 고르면 [만들기]가 잠깁니다.
 *
 * 두 모달의 내용이 같아 하나로 만들고 제목과 버튼 문구만 바꿉니다.
 * 입력값은 모달이 들고 있습니다. 열 때마다 비우려면 화면이 `key` 를 바꿔 새로 그립니다.
 */
export function CollectionFormModal(props: Props) {
  const { open, onClose, isSubmitting = false } = props
  const initial = props.mode === 'edit' ? props.initial : undefined

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [picked, setPicked] = useState<number[]>([])

  const trimmedTitle = title.trim()
  // 제목은 필수, 만들기는 향수도 하나 이상
  const canSubmit =
    trimmedTitle.length > 0 && (props.mode === 'edit' || picked.length > 0)

  const toggle = (shelfItemId: number) => {
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )
  }

  const submit = () => {
    const values: CollectionInput = {
      title: trimmedTitle,
      description: description.trim() || null,
    }
    if (props.mode === 'create') {
      props.onSubmit({ ...values, shelfItemIds: picked })
    } else {
      props.onSubmit(values)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={props.mode === 'edit' ? '컬렉션 수정' : '컬렉션 만들기'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onClick={submit}
          >
            {props.mode === 'edit' ? '저장' : '만들기'}
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
          maxLength={TITLE_MAX}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          label="설명"
          hideLabel
          placeholder="설명 (선택)"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {props.mode === 'edit' ? (
          <p className="text-ink-muted text-caption leading-relaxed">
            제목 · 설명만 수정합니다. 구성 향수는 컬렉션 상세에서 고칩니다.
          </p>
        ) : (
          <>
            <ShelfPerfumePicker
              candidates={props.candidates}
              picked={picked}
              onToggle={toggle}
            />
            <p className="text-ink-muted text-caption leading-relaxed">
              {picked.length}개 선택됨 · 진열대 향수를 하나 이상 골라야
              만들어집니다. 공개 · 비공개 상태가 없고, 남에게 보이는 길은 자유
              게시판의 컬렉션 공유 글뿐입니다.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
