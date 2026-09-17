import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import {
  AddToCollectionModal,
  CollectionFormModal,
  collectionDetailQuery,
  addCollectionPerfume,
  collectionKeys,
  deleteCollection,
  removeCollectionPerfume,
  updateCollection,
  type CollectionInput,
} from '@/features/collection'
import { shelfItemsQuery } from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
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
 * 컬렉션은 공개·비공개 구분이 없습니다 — 남에게 보이는 길은 자유 게시판의
 * 컬렉션 공유 글뿐입니다.
 *
 * 향수 추가 후보가 진열대에 있는 향수뿐이라(A19) 여기서 진열대 데이터를 함께
 * 불러 모달에 넘깁니다.
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /**
   * 컬렉션 수정 (COL-05). 제목 · 설명만 바뀝니다.
   *
   * 목록도 함께 갱신합니다 — 진열대 하단 띠가 같은 제목을 보여주고 있어서,
   * 상세만 고치면 돌아갔을 때 옛 제목이 남습니다.
   */
  const edit = useMutation({
    mutationFn: (input: CollectionInput) => updateCollection(numericId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(numericId),
      })
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      showToast('컬렉션을 수정했습니다')
    },
    onError: (error) =>
      showToast(
        // 이름이 겹치면 409 입니다. 서버 문구가 그 사정을 그대로 설명합니다
        isApiError(error) ? error.message : '컬렉션을 수정하지 못했습니다',
      ),
  })

  /**
   * 컬렉션 삭제 (COL-06).
   *
   * 지운 컬렉션의 상세 캐시를 버리고 진열대로 보냅니다 — 남겨 두면 뒤로가기로
   * 이미 없는 컬렉션 화면이 다시 뜹니다.
   */
  const remove = useMutation({
    mutationFn: () => deleteCollection(numericId),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(numericId),
      })
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      navigate(ROUTES.MY_SHELF, { replace: true })
    },
    onError: () => showToast('컬렉션을 삭제하지 못했습니다'),
  })

  /**
   * 향수 담기 (COL-03).
   *
   * 서버가 한 번에 하나씩 받아서 고른 만큼 요청이 나갑니다. **하나가 실패해도
   * 나머지는 계속 보냅니다** — 앞에서 멈추면 이미 담긴 것과 안 담긴 것이 섞인 채
   * 사용자는 무엇이 들어갔는지 알 수 없습니다.
   */
  const addPerfumes = useMutation({
    mutationFn: async (shelfItemIds: number[]) => {
      const results = await Promise.allSettled(
        shelfItemIds.map((shelfItemId) =>
          addCollectionPerfume(numericId, shelfItemId),
        ),
      )
      return results.filter((result) => result.status === 'rejected').length
    },
    onSuccess: (failed) => {
      void queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(numericId),
      })
      // 개수가 바뀌어 진열대 하단 띠의 "향수 N개" 도 낡습니다
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      showToast(
        failed === 0
          ? '향수를 추가했습니다'
          : `${failed}개는 추가하지 못했습니다`,
      )
    },
    onError: () => showToast('향수를 추가하지 못했습니다'),
  })

  /** 향수 빼기 (COL-04). 진열대 저장은 그대로 남습니다 */
  const removePerfume = useMutation({
    mutationFn: (shelfItemId: number) =>
      removeCollectionPerfume(numericId, shelfItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: collectionKeys.detail(numericId),
      })
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      showToast('컬렉션에서 제거했습니다')
    },
    onError: () => showToast('컬렉션에서 제거하지 못했습니다'),
  })

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
  /*
    확인창 제목에 넣을 대상 이름입니다. id 만 들고 있어 목록에서 찾아옵니다.

    ⚠️ **들고 있는 id 는 `shelfItemId`** 입니다 — 서버가 그 번호로 지웁니다
    (`DELETE .../perfumes/{shelfItemId}`). `perfumeId` 로 찾으면 이름도 못 찾고
    지우는 요청도 404 가 납니다.
  */
  const removeTargetName = data.perfumes.find(
    (item) => item.shelfItemId === removeTarget,
  )?.name

  return (
    <div className="space-y-6.25">
      <LinkButton to={ROUTES.MY_SHELF} variant="outline" size="sm">
        ← 진열대
      </LinkButton>

      <header className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <h1 className="text-ink text-display font-serif font-semibold">
            {data.title}
          </h1>
          <span className="ml-auto flex shrink-0 gap-2.5">
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
        <ul className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6">
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
                onClick={() => setRemoveTarget(perfume.shelfItemId)}
                className="border-line bg-surface-card text-ink-muted hover:text-ink text-caption rounded-card absolute top-3.75 right-3.75 border px-2.5 transition-colors duration-120 ease-out"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-ink-muted text-caption leading-relaxed">
        향수를 제거해도 진열대 저장은 유지됩니다. 컬렉션이 남에게 보이는 길은
        자유 게시판의 컬렉션 공유 글뿐입니다.
      </p>

      <CollectionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{ title: data.title, description: data.description }}
        onSubmit={(input) => {
          setEditOpen(false)
          edit.mutate(input)
        }}
      />

      <AddToCollectionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        // 진열대에 있고 아직 이 컬렉션에 없는 향수만 후보입니다
        /*
          진열대에 있고 아직 이 컬렉션에 없는 향수만 후보입니다. 서버가 담을 때
          shelfItemId 를 받으므로 진열대 항목을 그대로 넘깁니다 — perfumeId 로
          바꿔 넘기면 담고 뺄 번호를 잃습니다.
        */
        candidates={(shelf.data ?? []).filter(
          (item) => !inCollection.has(item.perfumeId),
        )}
        onSearch={() => {
          // TODO: 진열대 내 검색 연결
        }}
        onSubmit={(shelfItemIds) => {
          setAddOpen(false)
          addPerfumes.mutate(shelfItemIds)
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`'${removeTargetName ?? '향수'}' 를 컬렉션에서 제거할까요?`}
        description="진열대 저장은 그대로 유지됩니다."
        confirmLabel="제거"
        onConfirm={() => {
          if (removeTarget === null) return
          const shelfItemId = removeTarget
          setRemoveTarget(null)
          removePerfume.mutate(shelfItemId)
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`'${data.title}' 컬렉션을 삭제할까요?`}
        description="삭제하면 되돌릴 수 없습니다. 담긴 향수의 진열대 저장은 유지됩니다."
        onConfirm={() => {
          setDeleteOpen(false)
          remove.mutate()
        }}
      />

      <Toast {...toastProps} />
    </div>
  )
}
