import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import {
  CollectionFormModal,
  CollectionStrip,
  myCollectionsQuery,
} from '@/features/collection'
import {
  PerfumeRegisterModal,
  SHELF_SLOTS,
  ShelfItemPanel,
  ShelfRow,
  ShelfSaveModal,
  shelfItemsQuery,
  type ShelfItem,
} from '@/features/shelf'
import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/**
 * 내 진열대 (와이어프레임 A13 — SHF-02 · 03 · 05 · 06 · 09 · 10 · COL-01)
 *
 * 와이어프레임 주석을 그대로 지켰습니다.
 * - 진열대와 컬렉션이 한 페이지 — 컬렉션 목록 화면도, 진열대 하위 탭도 없다
 * - 필터 없음 — 분류가 진열대 세 칸으로 나뉘어 있어 고를 것이 없다 · 칸이 세 개로 고정
 * - 한 칸에 다 안 들어가면 다음 향수를 밀어 본다 (가로 스크롤)
 * - 향수 등록은 A15 등록 모달 2단계로 간다
 * - 대표 향수는 한 번에 하나 (보유 중 칸에만 표시)
 * - 메모는 향수 한 개당 하나 — 등록 모달에서 쓰고 여기서 수정한다
 *
 * 진열대와 컬렉션은 서로 다른 도메인입니다. features 끼리는 import 할 수 없으므로
 * 이 화면에서 두 도메인을 조합합니다.
 */
export default function MyShelfPage() {
  const shelf = useQuery(shelfItemsQuery())
  const collections = useQuery(myCollectionsQuery())

  const [selected, setSelected] = useState<ShelfItem | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [unsaveOpen, setUnsaveOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  if (shelf.isPending) return <PageFallback />

  const items = shelf.data ?? []

  return (
    <div className="space-y-8">
      {/* 내 진열대 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h1 className="text-ink text-lg font-bold">내 진열대</h1>
          <span className="text-ink-muted text-[10.5px]">{items.length}개</span>
          <Button className="ml-auto" onClick={() => setRegisterOpen(true)}>
            + 향수 등록
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          {/* 칸이 세 개로 고정입니다 */}
          <div className="min-w-0 space-y-6">
            {SHELF_SLOTS.map((slot) => (
              <ShelfRow
                key={slot.category}
                title={slot.title}
                items={items.filter((item) => item.category === slot.category)}
                selectedId={selected?.shelfItemId ?? null}
                onSelect={setSelected}
              />
            ))}
            <div className="text-ink-muted space-y-0.5 text-[10.5px] leading-relaxed">
              <p>
                필터 없음 — 분류가 진열대 세 칸으로 나뉘어 있어 고를 것이
                없습니다. 칸은 세 개로 고정입니다.
              </p>
              <p>
                한 칸에 다 안 들어가면 오른쪽 버튼으로 다음 향수를 밀어 봅니다.
              </p>
            </div>
          </div>

          <ShelfItemPanel
            item={selected}
            onSetRepresentative={() => {
              // TODO: SHF-05 대표 향수 지정 API 연결
              showToast('대표 향수로 지정했습니다')
            }}
            onUnsave={() => setUnsaveOpen(true)}
            onChangeCategory={() => setChangeCategoryOpen(true)}
            onEditMemo={() => {
              // TODO: SHF-10 메모 수정 API 연결
              showToast('메모 수정은 API 연결 후 동작합니다')
            }}
          />
        </div>
      </section>

      <hr className="border-line" />

      {/* 내 컬렉션 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-lg font-bold">내 컬렉션</h2>
          <span className="text-ink-muted text-[10.5px]">
            {collections.data?.length ?? 0}개
          </span>
        </div>

        <CollectionStrip
          items={collections.data ?? []}
          isPending={collections.isPending}
          onCreate={() => setCreateCollectionOpen(true)}
        />
      </section>

      {/*
        등록 모달의 후보 목록은 이 화면에서 만들어 넘깁니다.
        TODO: 향수 검색 결과를 연결하세요. 지금은 진열대에 이미 있는 향수만
        "담김" 상태로 보여줍니다 (선택 불가).
      */}
      <PerfumeRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        options={items.map((item) => ({
          perfumeId: item.perfumeId,
          name: item.name,
          brand: item.brand,
          thumbnailUrl: item.thumbnailUrl,
          alreadyInShelf: true,
        }))}
        onSearch={() => {
          // TODO: 향수 검색 API 연결 (화면에서 조합)
        }}
        onSubmit={() => {
          // TODO: SHF-01 진열대 등록 API 연결
          setRegisterOpen(false)
          showToast('진열대에 담았습니다')
        }}
      />

      <CollectionFormModal
        open={createCollectionOpen}
        onClose={() => setCreateCollectionOpen(false)}
        onSubmit={() => {
          // TODO: COL-01 컬렉션 생성 API 연결
          setCreateCollectionOpen(false)
          showToast('컬렉션을 만들었습니다')
        }}
      />

      {/*
        분류 변경은 A11 진열대 저장 모달과 구성이 같아 같은 컴포넌트를 씁니다.
        현재 분류를 넘기면 제목·버튼이 "분류 변경"이 되고 그 분류가 미리 선택됩니다.
      */}
      <ShelfSaveModal
        open={changeCategoryOpen}
        onClose={() => setChangeCategoryOpen(false)}
        initialCategory={selected?.category ?? null}
        onSave={() => {
          // TODO: SHF-03 분류 변경 API 연결 (백엔드 진열대 API 미구현)
          setChangeCategoryOpen(false)
          showToast('분류를 변경했습니다')
        }}
      />

      <ConfirmDialog
        open={unsaveOpen}
        onClose={() => setUnsaveOpen(false)}
        title={`'${selected?.name ?? '향수'}' 저장을 해제할까요?`}
        description="진열대에서 빠지고 메모와 적합도도 함께 사라집니다."
        confirmLabel="저장 해제"
        onConfirm={() => {
          // TODO: SHF-02 저장 해제 API 연결
          setUnsaveOpen(false)
          setSelected(null)
          showToast('저장을 해제했습니다')
        }}
      />

      <Toast {...toastProps} />
    </div>
  )
}
