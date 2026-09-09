import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import {
  AddToCollectionModal,
  CollectionFormModal,
  collectionDetailQuery,
} from '@/features/collection'
import { shelfItemsQuery, toPerfumeOption } from '@/features/shelf'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { PerfumeCard } from '@/shared/ui/PerfumeCard'
import { Toast } from '@/shared/ui/Toast'

/**
 * 컬렉션 상세 (와이어프레임 A17 — COL-04 · COL-07)
 *
 * 와이어프레임 주석:
 * - 향수를 제거해도 진열대 저장은 유지된다
 * - 컬렉션은 공개 · 비공개 구분이 없다 — 남에게 보이는 길은 자유 게시판의
 *   컬렉션 공유 글뿐이다
 *
 * 향수 추가 후보는 진열대에 있는 향수뿐이라(A19 주석) 이 화면에서 진열대 데이터를
 * 함께 불러 모달에 넘깁니다. features 끼리는 import 할 수 없으므로 조합은 여기서 합니다.
 */
export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const numericId = Number(collectionId)

  const collection = useQuery({
    ...collectionDetailQuery(numericId),
    enabled: Number.isFinite(numericId),
  })
  const shelf = useQuery(shelfItemsQuery())

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<number | null>(null)
  const { showToast, toastProps } = useToast()

  if (collection.isPending) return <PageFallback />
  if (collection.isError || !collection.data) {
    return (
      <EmptyState
        title="컬렉션 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => collection.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const data = collection.data
  const inCollection = new Set(data.perfumes.map((item) => item.perfumeId))
  // 확인창 제목에 넣을 대상 이름입니다. id 만 들고 있어 목록에서 찾아옵니다.
  const removeTargetName = data.perfumes.find(
    (item) => item.perfumeId === removeTarget,
  )?.name

  return (
    <div className="space-y-6">
      <LinkButton to={ROUTES.MY_SHELF} variant="outline" size="sm">
        ← 진열대
      </LinkButton>

      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <h1 className="text-ink text-display font-serif font-semibold">
            {data.title}
          </h1>
          <span className="ml-auto flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              삭제
            </Button>
          </span>
        </div>
        {data.description && (
          <p className="text-ink-muted text-body">{data.description}</p>
        )}
        <p className="text-ink text-caption">향수 {data.perfumeCount}개</p>
      </header>

      <hr className="border-line" />

      <Button onClick={() => setAddOpen(true)}>+ 향수 추가</Button>

      {data.perfumes.length === 0 ? (
        <EmptyState
          title="담긴 향수가 없습니다"
          description="진열대에 저장한 향수를 컬렉션에 넣어보세요."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {data.perfumes.map((perfume) => (
            <li key={perfume.perfumeId} className="relative">
              <PerfumeCard
                name={perfume.name}
                brand={perfume.brand}
                thumbnailUrl={perfume.thumbnailUrl}
                to={toPerfumeDetail(perfume.perfumeId)}
              />
              {/* 제거해도 진열대 저장은 유지됩니다 */}
              <button
                type="button"
                aria-label={`${perfume.name} 컬렉션에서 제거`}
                onClick={() => setRemoveTarget(perfume.perfumeId)}
                className="border-line bg-surface-card text-ink-muted hover:text-ink text-caption rounded-card absolute top-4 right-4 border px-2 transition-colors duration-120 ease-out"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-muted text-caption leading-relaxed">
        향수를 제거해도 진열대 저장은 유지됩니다. 컬렉션은 공개 · 비공개 구분이
        없고, 남에게 보이는 길은 자유 게시판의 컬렉션 공유 글뿐입니다.
      </p>

      <CollectionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{ title: data.title, description: data.description }}
        onSubmit={() => {
          // TODO: COL-05 컬렉션 수정 API 연결
          setEditOpen(false)
          showToast('컬렉션을 수정했습니다')
        }}
      />

      <AddToCollectionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        // 진열대에 있고 아직 이 컬렉션에 없는 향수만 후보입니다
        candidates={(shelf.data ?? [])
          .filter((item) => !inCollection.has(item.perfumeId))
          .map(toPerfumeOption)}
        onSearch={() => {
          // TODO: 진열대 내 검색 연결
        }}
        onSubmit={() => {
          // TODO: COL-03 향수 추가 API 연결
          setAddOpen(false)
          showToast('향수를 추가했습니다')
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`'${removeTargetName ?? '향수'}' 를 컬렉션에서 제거할까요?`}
        description="진열대 저장은 그대로 유지됩니다."
        confirmLabel="제거"
        onConfirm={() => {
          // TODO: COL-04 향수 제거 API 연결
          setRemoveTarget(null)
          showToast('컬렉션에서 제거했습니다')
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`'${data.title}' 컬렉션을 삭제할까요?`}
        description="삭제하면 되돌릴 수 없습니다. 담긴 향수의 진열대 저장은 유지됩니다."
        onConfirm={() => {
          // TODO: COL-06 컬렉션 삭제 API 연결 후 진열대로 이동
          setDeleteOpen(false)
        }}
      />

      <Toast {...toastProps} />
    </div>
  )
}
