import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import {
  CollectionFormModal,
  CollectionStrip,
  myCollectionsQuery,
} from '@/features/collection'
import {
  CollectionDetailPanel,
  CollectionFilters,
  CollectionFooterStrip,
  DisplayCase,
  PerfumeRegisterModal,
  ShelfSaveModal,
  shelfItemsQuery,
  type CollectionFilterValue,
  type ShelfItem,
} from '@/features/shelf'
import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/**
 * 나의 향 컬렉션 (A13 재디자인 시안)
 *
 * 진열대 세 칸을 **진열장 하나로 합쳤습니다.** 분류는 상단 필터 칩으로 좁혀 봅니다.
 * 와이어프레임 A13 은 "칸은 세 개로 고정" 이었지만, 시안이 한 진열장에 모두 세우고
 * 칩으로 거르는 쪽으로 바뀌었습니다.
 *
 * 선택한 향수는 오른쪽 패널에 펼쳐집니다. 하단 페이저로도 넘길 수 있어서,
 * 병을 하나씩 눌러 보지 않아도 순서대로 훑을 수 있습니다.
 *
 * 진열대와 컬렉션은 서로 다른 도메인입니다. features 끼리는 import 할 수 없으므로
 * 이 화면에서 두 도메인을 조합합니다.
 */
export default function MyShelfPage() {
  const shelf = useQuery(shelfItemsQuery())
  const collections = useQuery(myCollectionsQuery())

  const [filter, setFilter] = useState<CollectionFilterValue>('ALL')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [changeCategoryOpen, setChangeCategoryOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  const items = useMemo(() => shelf.data ?? [], [shelf.data])

  const counts = useMemo(
    () => ({
      all: items.length,
      owned: items.filter((item) => item.category === 'OWNED').length,
      tried: items.filter((item) => item.category === 'TRIED').length,
      wish: items.filter((item) => item.category === 'WISH').length,
    }),
    [items],
  )

  // 칩과 검색어는 겹쳐 걸립니다. 검색은 향수명과 브랜드명을 함께 봅니다.
  const visible = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'ALL' && item.category !== filter) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        item.brand.toLowerCase().includes(needle)
      )
    })
  }, [items, filter, keyword])

  // 걸러진 목록이 바뀌면 선택이 사라질 수 있습니다. 그때는 첫 향수를 고릅니다 —
  // 오른쪽 패널이 비어 있으면 화면 절반이 빈 채로 남습니다.
  const selectedIndex = visible.findIndex(
    (item) => item.shelfItemId === selectedId,
  )
  const current = selectedIndex >= 0 ? selectedIndex : 0
  const selected: ShelfItem | null = visible[current] ?? null

  const move = (step: 1 | -1) => {
    const next = visible[current + step]
    if (next) setSelectedId(next.shelfItemId)
  }

  if (shelf.isPending) return <PageFallback />

  return (
    <div className="space-y-8">
      {/* 머리말과 필터가 한 줄에 놓입니다 */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <header className="shrink-0 space-y-2">
          <p className="text-ink-muted text-caption tracking-[0.18em] uppercase">
            Every scent
            <br />
            has a story
          </p>
          <h1 className="text-ink text-display font-serif font-semibold">
            나의 향 컬렉션
          </h1>
          <p className="text-ink-muted text-body">
            수집한 향들이 모여,
            <br />
            나라는 이야기가 됩니다.
          </p>
        </header>

        <CollectionFilters
          counts={counts}
          value={filter}
          onChange={(next) => {
            setFilter(next)
            setSelectedId(null)
          }}
          keyword={keyword}
          onKeywordChange={(next) => {
            setKeyword(next)
            setSelectedId(null)
          }}
          className="flex-1 lg:pt-8"
        />
      </div>

      {/* 진열장과 상세 패널 */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <DisplayCase
          items={visible}
          selectedId={selected?.shelfItemId ?? null}
          onSelect={(item) => setSelectedId(item.shelfItemId)}
          className="min-w-0 flex-1"
        />

        <CollectionDetailPanel
          item={selected}
          onClose={() => setSelectedId(null)}
          onSave={() => showToast('나의 향수로 저장했습니다')}
          className="w-full shrink-0 lg:w-80"
        />
      </div>

      <CollectionFooterStrip
        index={visible.length === 0 ? 0 : current + 1}
        total={visible.length}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
      />

      {/* 내 컬렉션 — 시안에는 없지만 A13 의 아래 절반이라 그대로 둡니다 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-title font-serif font-semibold">
            내 컬렉션
          </h2>
          <span className="text-ink-muted text-caption">
            {collections.data?.length ?? 0}개
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setRegisterOpen(true)}
          >
            + 향수 등록
          </Button>
        </div>

        <CollectionStrip
          items={collections.data ?? []}
          isPending={collections.isPending}
          onCreate={() => setCreateCollectionOpen(true)}
        />
      </section>

      <PerfumeRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        // 1단계 후보. 향수 도메인 데이터를 이 모양으로 맞춰 넘깁니다.
        // ⚠️ 아직 검색 API 를 붙이지 않아 진열대에 있는 향수를 그대로 씁니다.
        options={items.map((item) => ({
          perfumeId: item.perfumeId,
          name: item.name,
          brand: item.brand,
          thumbnailUrl: item.thumbnailUrl,
        }))}
        onSearch={() => {
          // TODO: SHF-01 향수 검색 연결
        }}
        onSubmit={() => {
          setRegisterOpen(false)
          showToast('진열대에 등록했습니다')
        }}
      />
      <CollectionFormModal
        open={createCollectionOpen}
        onClose={() => setCreateCollectionOpen(false)}
        onSubmit={() => {
          setCreateCollectionOpen(false)
          showToast('컬렉션을 만들었습니다')
        }}
      />
      <ShelfSaveModal
        open={changeCategoryOpen}
        onClose={() => setChangeCategoryOpen(false)}
        onSave={() => {
          setChangeCategoryOpen(false)
          showToast('분류를 바꿨습니다')
        }}
      />
      <Toast {...toastProps} />
    </div>
  )
}
