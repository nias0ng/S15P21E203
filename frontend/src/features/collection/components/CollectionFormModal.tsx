import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import type { CollectionInput } from '../types'

import { ShelfItemPickList, type ShelfItemCandidate } from './ShelfItemPickList'

type Props = {
  open: boolean
  onClose: () => void
  /**
   * 만들 때는 **고른 진열대 항목**이 함께 옵니다 — 서버가 최소 하나를 요구합니다.
   * 수정할 때는 빈 배열입니다(구성 향수는 A17 에서 고칩니다).
   */
  onSubmit: (input: CollectionInput, shelfItemIds: number[]) => void
  /** 값이 있으면 수정(COL-05), 없으면 만들기(COL-01) 입니다. */
  initial?: CollectionInput
  /** 만들 때 고를 수 있는 진열대 항목. 수정할 때는 쓰지 않습니다 */
  candidates?: ShelfItemCandidate[]
}

/**
 * 컬렉션 만들기 · 수정 모달 (A19 — COL-01 · COL-05). 수정은 제목 · 설명만 바꿉니다.
 * ⚠️ **"향수 없이도 생성 가능" 은 지킬 수 없습니다** — 서버가 `shelfItemIds` 를
 * `@NotEmpty` 로 요구해 고르지 않으면 400 입니다.
 */
export function CollectionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  candidates = [],
}: Props) {
  const editing = initial !== undefined
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')

  /*
   * 열릴 때마다 칸을 되돌립니다. `Modal` 이 `<dialog>` 라 **닫아도 언마운트되지
   * 않아** 앞서 적던 값이 남습니다. `useEffect` 가 아니라 렌더 중에 맞추는 이유:
   * 한 박자 늦으면 첫 프레임에 옛 값이 보입니다.
   */
  const openedKey = open ? JSON.stringify(initial ?? null) : null
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (openedKey !== openedFor) {
    setOpenedFor(openedKey)
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setPicked([])
    setKeyword('')
  }

  const toggle = (shelfItemId: number) =>
    setPicked((prev) =>
      prev.includes(shelfItemId)
        ? prev.filter((id) => id !== shelfItemId)
        : [...prev, shelfItemId],
    )

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
            /*
              제목은 필수이고, 만들 때는 향수도 최소 하나 골라야 합니다
              (서버가 shelfItemIds 를 @NotEmpty 로 요구합니다).
            */
            disabled={
              title.trim().length === 0 || (!editing && picked.length === 0)
            }
            onClick={() => {
              onSubmit(
                {
                  title: title.trim(),
                  description: description.trim() || null,
                },
                picked,
              )
              setPicked([])
              setKeyword('')
            }}
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
          <>
            <ShelfItemPickList
              candidates={candidates}
              picked={picked}
              onToggle={toggle}
              keyword={keyword}
              onKeywordChange={setKeyword}
              emptyTitle="진열대에 담은 향수가 없습니다"
            />
            <p className="text-ink-muted text-caption leading-relaxed">
              컬렉션이 남에게 보이는 길은 자유 게시판의 컬렉션 공유 글뿐입니다.
              향수는 나중에 더 담을 수 있습니다.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
