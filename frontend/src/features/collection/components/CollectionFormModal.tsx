import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useResetOnOpen } from '@/shared/hooks/useResetOnOpen'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { Textarea } from '@/shared/ui/Textarea'

import { useShelfItemPick } from '../hooks/useShelfItemPick'
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
  const { t } = useTranslation('collection')
  const editing = initial !== undefined
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const { picked, toggle, keyword, setKeyword } = useShelfItemPick(open)

  /*
   * `Modal` 이 `<dialog>` 라 닫아도 언마운트되지 않아 앞서 적던 값이 남습니다.
   */
  const openedKey = open ? JSON.stringify(initial ?? null) : null
  useResetOnOpen(openedKey, () => {
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('form.editTitle') : t('form.createTitle')}
      className={cn(COLLECTION_SHEET, !editing && PICK_SHEET_WIDTH)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            disabled={
              title.trim().length === 0 || (!editing && picked.length === 0)
            }
            onClick={() =>
              onSubmit(
                {
                  title: title.trim(),
                  description: description.trim() || null,
                },
                picked,
              )
            }
          >
            {editing ? t('form.save') : t('form.create')}
          </Button>
        </>
      }
    >
      {/* 남는 높이를 고르는 칸까지 이어 줍니다(COLLECTION_SHEET 의 본문 흐름) — 낮은 창에서 칸만 줄어듭니다 */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 py-1.25">
        <Input
          label={t('form.name')}
          placeholder={t('form.namePlaceholder')}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="text-heading border-[var(--hairline)] bg-[var(--tag-paper-active)] px-3.75 font-serif font-semibold"
        />
        <Textarea
          label={t('form.description')}
          placeholder={t('form.descriptionPlaceholder')}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="text-heading border-[var(--hairline)] bg-[var(--tag-paper-active)] px-3.75 font-serif"
        />

        {editing ? (
          <p className="shelf-muted text-body leading-relaxed">
            {t('form.editHint')}
          </p>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col gap-3.75">
            <h3 className="collection-sheet-heading">
              {t('form.pickHeading')}
            </h3>
            <ShelfItemPickList
              candidates={candidates}
              picked={picked}
              onToggle={toggle}
              keyword={keyword}
              onKeywordChange={setKeyword}
              emptyTitle={t('form.pickEmpty')}
              // 위에 이름 · 설명 칸이 있어 고르는 칸의 윗한도를 낮춥니다(1920 에서 380). 창이 낮으면 더 줄어듭니다
              listClassName="max-h-[calc(var(--spacing)*95)]"
            />
            <p className="shelf-muted text-caption leading-relaxed">
              {t('form.visibility')}
            </p>
          </section>
        )}
      </div>
    </Modal>
  )
}
