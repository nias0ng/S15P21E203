import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import {
  AddToCollectionModal,
  CollectionFormModal,
  CollectionNotice,
  CollectionPerfumeGrid,
  collectionDetailQuery,
  addCollectionPerfume,
  collectionKeys,
  deleteCollection,
  removeCollectionPerfume,
  updateCollection,
  type CollectionInput,
} from '@/features/collection'
import { ShelfPaper, shelfItemsQuery } from '@/features/shelf'
import { apiErrorMessage, isApiError } from '@/shared/api/http'
import { toMyShelfCollection } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { parseId } from '@/shared/lib/parseId'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkButton } from '@/shared/ui/LinkButton'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/** 진열대 종이 위의 단추 포커스 링 — 링과 오프셋 색만 종이에 맞춥니다(MyShelfPage 와 같은 까닭) */
const PAPER_RING =
  'focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-[var(--paper)]'

/**
 * 컬렉션 상세 (A17 — COL-04 · COL-07). 향수 추가 후보가 진열대 항목뿐이라(A19)
 * 진열대 데이터를 함께 불러 넘깁니다.
 *
 * 내 컬렉션 무대에서 진열함을 눌러 들어오는 화면이라 **같은 진열대 종이 위에** 섭니다(ShelfPaper).
 * 넓은 화면은 두 기둥입니다 — 왼쪽에 이름 · 설명 · 개수 · 단추(스크롤해도 따라옵니다), 오른쪽에 향수마다
 * 한 병이 서는 진열함(CollectionPerfumeGrid). 1024 아래에서는 위아래로 이어 세웁니다.
 */
export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const parsedId = parseId(collectionId)
  // 주소를 손으로 고쳐 번호가 아니면 부르지 않습니다 — 부르지 않은 쿼리는 끝없이 "받는 중" 입니다
  const validId = parsedId !== null
  // 번호가 아니면 아래 요청은 하나도 나가지 않아 0 은 자리만 채웁니다
  const numericId = parsedId ?? 0

  const collection = useQuery({
    ...collectionDetailQuery(numericId),
    enabled: validId,
  })
  const shelf = useQuery(shelfItemsQuery())

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<number | null>(null)
  const { showToast, toastProps } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 목록도 함께 갱신합니다 — 진열대의 내 컬렉션 무대가 같은 이름을 보여주고 있어 상세만
  // 고치면 옛 이름이 남습니다
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
        // 이름이 겹치면 409 이고, 서버 문구가 그 사정을 그대로 설명합니다
        apiErrorMessage(error, '컬렉션을 수정하지 못했습니다'),
      ),
  })

  // 캐시를 버리지 않으면 뒤로가기로 다시 뜹니다. 지운 뒤에는 들어온 자리(내 컬렉션 무대)로 갑니다
  const remove = useMutation({
    mutationFn: () => deleteCollection(numericId),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: collectionKeys.detail(numericId),
      })
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      navigate(toMyShelfCollection(), { replace: true })
    },
    onError: () => showToast('컬렉션을 삭제하지 못했습니다'),
  })

  // 서버가 한 번에 하나씩 받아 고른 만큼 요청이 나가고, 하나가 실패해도 나머지는
  // 계속 보냅니다
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
      void queryClient.invalidateQueries({ queryKey: collectionKeys.mine() })
      showToast(
        failed === 0 ? '향수를 담았습니다' : `${failed}개는 담지 못했습니다`,
      )
    },
    onError: () => showToast('향수를 담지 못했습니다'),
  })

  // 컬렉션에서 빼도 진열대 저장은 그대로 남습니다
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

  if (validId && collection.isPending) return <PageFallback />

  const backToCollections = (
    <Link
      to={toMyShelfCollection()}
      className="shelf-muted text-body rounded-card inline-flex items-center gap-1.25 transition-colors duration-120 ease-out outline-none hover:text-[var(--shelf-ink)] focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
    >
      <span aria-hidden>←</span> 내 컬렉션
    </Link>
  )

  if (!validId || collection.isError || !collection.data) {
    // 지워졌거나 남의 컬렉션이면 다시 불러도 소용없어 돌아가는 길만 둡니다
    const missing =
      !validId ||
      (isApiError(collection.error) &&
        (collection.error.status === 404 || collection.error.status === 403))

    return (
      <div className="shelf-scope">
        <ShelfPaper />
        {backToCollections}
        <CollectionNotice
          title={
            missing
              ? '컬렉션을 찾을 수 없습니다'
              : '컬렉션을 불러오지 못했습니다'
          }
          description={
            missing
              ? '지워졌거나 주소가 바뀌었을 수 있어요.'
              : '잠시 후 다시 시도해 주세요.'
          }
          onRetry={missing ? undefined : () => void collection.refetch()}
          action={
            missing ? (
              <LinkButton
                to={toMyShelfCollection()}
                variant="outline"
                size="sm"
                className={PAPER_RING}
              >
                내 컬렉션으로
              </LinkButton>
            ) : undefined
          }
        />
      </div>
    )
  }

  const data = collection.data
  const inCollection = new Set(data.perfumes.map((item) => item.perfumeId))
  // NOTE: 들고 있는 id 는 `shelfItemId` 입니다 — `perfumeId` 로 찾으면 이름도 못 찾고
  // 지우는 요청도 404 입니다
  const removeTargetName = data.perfumes.find(
    (item) => item.shelfItemId === removeTarget,
  )?.name

  return (
    <div className="shelf-scope">
      <ShelfPaper />

      <div className="grid gap-y-12.5 lg:grid-cols-[calc(var(--spacing)*100)_minmax(0,1fr)] lg:gap-x-20">
        {/*
          이름 · 설명 · 개수 · 단추. 넓은 화면에서는 헤더 밑에 붙어 따라옵니다 — 향수가 많아 오른쪽을
          내려 봐도 어느 컬렉션인지, 어디서 고치는지가 늘 보입니다.
        */}
        <header className="lg:sticky lg:top-[calc(var(--header-h)+var(--spacing)*10)] lg:self-start">
          {backToCollections}

          {/*
            활자는 컬렉션의 다섯 단을 따릅니다(collection-cabinet.css 머리말) — 머리글 12 · 제목 28 ·
            설명 16 · 개수 13. 줄 사이는 20 한 가지로 둡니다.
          */}
          <p className="collection-kicker mt-10" lang="en">
            Collection
          </p>
          <h1 className="text-display mt-2.5 font-serif font-semibold break-keep">
            {data.title}
          </h1>
          <span
            aria-hidden
            className="mt-5 block h-px w-10 bg-[var(--hairline)]"
          />

          {/*
            설명은 사용자가 적어 둔 메모라 옅은 부제가 아니라 먹 명조로 적습니다. 없으면 어디서
            적는지를 알려 줍니다.
          */}
          {data.description ? (
            <p className="text-heading mt-5 font-serif leading-[1.75] break-keep whitespace-pre-line">
              {data.description}
            </p>
          ) : (
            <p className="shelf-muted text-body mt-5 break-keep">
              아직 설명이 없어요. [수정]에서 어떤 때 꺼내는 향들인지 적어 둘 수
              있어요.
            </p>
          )}

          <p className="text-body mt-5 font-medium tabular-nums">
            향수 {data.perfumeCount}개
          </p>

          {/*
            상세 카드의 단추 둘과 같은 높이(40) · 모서리입니다. 공용 테두리(border-line)는 진열대 종이에서
            거의 안 보여 종이 선 색으로 긋고, 되돌릴 수 없는 [삭제] 는 경고색 테두리입니다.
          */}
          <div className="mt-7.5 flex gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className={`h-10 rounded-md border-[var(--hairline)] px-5 ${PAPER_RING}`}
              onClick={() => setEditOpen(true)}
            >
              수정
            </Button>
            <Button
              variant="dangerOutline"
              size="sm"
              className={`h-10 rounded-md px-5 ${PAPER_RING}`}
              onClick={() => setDeleteOpen(true)}
            >
              삭제
            </Button>
          </div>
        </header>

        {/* 넓은 화면에서는 진열함 윗선을 왼쪽의 영문 머리(COLLECTION) 줄에 맞춥니다 */}
        <section aria-label="담긴 향수" className="lg:mt-15">
          <CollectionPerfumeGrid
            perfumes={data.perfumes}
            onRemove={(perfume) => setRemoveTarget(perfume.shelfItemId)}
            onAdd={() => setAddOpen(true)}
          />
        </section>
      </div>

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
        /*
          진열대에 있고 아직 이 컬렉션에 없는 향수만 후보입니다. 서버가 담을 때
          shelfItemId 를 받으므로 진열대 항목을 그대로 넘깁니다 — perfumeId 로 바꿔
          넘기면 담고 뺄 번호를 잃습니다.
        */
        candidates={(shelf.data ?? []).filter(
          (item) => !inCollection.has(item.perfumeId),
        )}
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
