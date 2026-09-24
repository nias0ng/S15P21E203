import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import type { CollectionInput } from '../types'

import { COLLECTION_SHEET, PICK_SHEET_WIDTH } from './collectionSheet'
import { ShelfItemPickList, type ShelfItemCandidate } from './ShelfItemPickList'

type Props = {
  open: boolean
  onClose: () => void
  /** 만들 때는 고른 진열대 항목이 함께 옵니다. 수정할 때는 빈 배열입니다 */
  onSubmit: (input: CollectionInput, shelfItemIds: number[]) => void
  /** 값이 있으면 수정(COL-05), 없으면 만들기(COL-01) 입니다 */
  initial?: CollectionInput
  candidates?: ShelfItemCandidate[]
}

/**
 * 컬렉션 만들기 · 수정 모달 (A19). NOTE: 서버가 `shelfItemIds` 를 `@NotEmpty` 로 요구해
 * "향수 없이도 생성 가능" 은 지킬 수 없습니다 — 고르지 않으면 400 입니다.
 *
 * 이름 · 설명은 칸 위에 이름표를 보이게 답니다 — 자리표시 글만 두면 적기 시작하는 순간 무엇을 적는
 * 칸인지 사라집니다. 두 칸은 명판 이름 · 상세 설명과 같은 명조 16 으로 받아, 적는 동안에도 설 모양이
 * 보입니다(collection-cabinet.css 의 활자 단).
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
   * `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않아 앞서 적던 값이 남습니다.
   * `useEffect` 가 아니라 렌더 중에 되돌리는 이유: 한 박자 늦으면 첫 프레임에 옛 값이 보입니다.
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
      className={cn(COLLECTION_SHEET, !editing && PICK_SHEET_WIDTH)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
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
      <div className="space-y-5 py-1.25">
        <Input
          label="이름"
          placeholder="예: 출근할 때"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="text-heading border-[var(--hairline)] bg-[var(--tag-paper-active)] px-3.75 font-serif font-semibold"
        />
        <Textarea
          label="설명 (선택)"
          placeholder="어떤 때 꺼내는 향들인지 적어 두세요"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="text-heading border-[var(--hairline)] bg-[var(--tag-paper-active)] px-3.75 font-serif"
        />

        {editing ? (
          <p className="shelf-muted text-body leading-relaxed">
            이름 · 설명만 고칩니다. 향수는 진열함 칸에서 담고 뺍니다.
          </p>
        ) : (
          <section className="space-y-3.75">
            <h3 className="collection-sheet-heading">담을 향수</h3>
            <ShelfItemPickList
              candidates={candidates}
              picked={picked}
              onToggle={toggle}
              keyword={keyword}
              onKeywordChange={setKeyword}
              emptyTitle="진열대에 담은 향수가 없습니다"
              // 위에 이름 · 설명 칸이 있어 고르는 칸을 낮춥니다 — 1536 x 864 에서도 모달이 창 안에 듭니다
              listClassName="max-h-[min(calc(var(--spacing)*95),40vh)]"
            />
            <p className="shelf-muted text-caption leading-relaxed">
              컬렉션이 남에게 보이는 길은 자유 게시판의 컬렉션 공유 글뿐입니다.
              향수는 나중에 더 담을 수 있습니다.
            </p>
          </section>
        )}
      </div>
    </Modal>
  )
}
