import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import { useShelfItemPick } from '../hooks/useShelfItemPick'

import { COLLECTION_SHEET, PICK_SHEET_WIDTH } from './collectionSheet'
import { ShelfItemPickList, type ShelfItemCandidate } from './ShelfItemPickList'

type Props = {
  open: boolean
  onClose: () => void
  /** 진열대에 있는 향수만 넘깁니다 — 진열대에 없는 향수는 컬렉션에 넣을 수 없습니다 */
  candidates: ShelfItemCandidate[]
  /** 진열대 항목 번호입니다 — 서버가 `shelfItemIds` 로 받습니다 */
  onSubmit: (shelfItemIds: number[]) => void
}

/** 컬렉션에 향수 담기 모달 (A19 우 — COL-03) */
export function AddToCollectionModal({
  open,
  onClose,
  candidates,
  onSubmit,
}: Props) {
  const { picked, toggle, keyword, setKeyword } = useShelfItemPick(open)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="향수 담기"
      className={cn(COLLECTION_SHEET, PICK_SHEET_WIDTH)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => onSubmit(picked)}
          >
            담기
          </Button>
        </>
      }
    >
      <ShelfItemPickList
        candidates={candidates}
        picked={picked}
        onToggle={toggle}
        keyword={keyword}
        onKeywordChange={setKeyword}
        emptyTitle="더 담을 향수가 없습니다"
      />
    </Modal>
  )
}
