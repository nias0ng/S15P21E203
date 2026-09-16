import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import {
  AddToCollectionModal,
  CollectionAddPartialError,
  CollectionFormModal,
  collectionDetailQuery,
  useCollectionActions,
} from '@/features/collection'
import { shelfItemsQuery } from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { useIsLoggedIn } from '@/shared/store/authStore'
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
 * 불러 모달에 넘깁니다. 두 도메인은 서로 import 할 수 없어 화면이 조합합니다.
 *
 * 컬렉션 API 는 전부 `/users/me/...` 라 **내 컬렉션만** 열립니다 — 남의 번호를 넣으면 404 입니다.
 */
export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const numericId = Number(collectionId)
  const validId = Number.isInteger(numericId) && numericId > 0
  const isLoggedIn = useIsLoggedIn()
  const navigate = useNavigate()

  // 비로그인이면 부르지 않습니다 — 401 을 "불러오지 못했다" 로 보여주면 고장난 것처럼 읽힙니다
  const collection = useQuery({
    ...collectionDetailQuery(numericId),
    enabled: validId && isLoggedIn,
  })
  const shelf = useQuery({ ...shelfItemsQuery(), enabled: isLoggedIn })
  const actions = useCollectionActions()

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // 모달을 열 때마다 새로 그려 앞서 적은 값 · 고른 향수를 비웁니다
  const [modalKey, setModalKey] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  /** 뺄 향수의 진열대 항목 번호 */
  const [removeTarget, setRemoveTarget] = useState<number | null>(null)
  const { showToast, toastProps } = useToast()

  if (!isLoggedIn) {
    return (
      <EmptyState
        title="로그인하면 컬렉션을 볼 수 있습니다"
        description="컬렉션은 내 진열대의 향수로 만들어 계정에 저장됩니다."
        action={
          <LinkButton to={ROUTES.LOGIN} variant="outline" size="sm">
            로그인하러 가기
          </LinkButton>
        }
      />
    )
  }

  const notFound = (
    <EmptyState
      title="컬렉션을 찾을 수 없습니다"
      description="지워졌거나 내 컬렉션이 아닙니다."
      action={
        <LinkButton to={ROUTES.MY_SHELF} variant="outline" size="sm">
          진열대로 가기
        </LinkButton>
      }
    />
  )

  if (!validId) return notFound
  if (collection.isPending) return <PageFallback />
  if (collection.isError) {
    if (isApiError(collection.error) && collection.error.status === 404) {
      return notFound
    }
    return (
      <EmptyState
        title="컬렉션 상세 정보를 불러오지 못했습니다"
        description="다시 시도해주세요."
        action={
          <Button variant="outline" onClick={() => void collection.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const data = collection.data
  const inCollection = new Set(data.perfumes.map((item) => item.shelfItemId))
  // 확인창 제목에 넣을 대상 이름입니다. 번호만 들고 있어 목록에서 찾아옵니다.
  const removeTargetName = data.perfumes.find(
    (item) => item.shelfItemId === removeTarget,
  )?.name

  const openModal = (open: (value: boolean) => void) => {
    setModalKey((key) => key + 1)
    open(true)
  }

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
              onClick={() => openModal(setEditOpen)}
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

      <Button onClick={() => openModal(setAddOpen)}>+ 향수 추가</Button>

      {data.perfumes.length === 0 ? (
        <EmptyState
          title="담긴 향수가 없습니다"
          description="진열대에 저장한 향수를 컬렉션에 넣어보세요."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3.75 sm:grid-cols-3 lg:grid-cols-6">
          {data.perfumes.map((perfume) => (
            <li key={perfume.shelfItemId} className="relative">
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
        향수를 제거해도 진열대 저장은 유지됩니다. 컬렉션에는 향수가 하나 이상
        있어야 해서 마지막 향수는 뺄 수 없습니다 — 비우려면 컬렉션을 삭제하세요.
        컬렉션은 공개 · 비공개 구분이 없고, 남에게 보이는 길은 자유 게시판의
        컬렉션 공유 글뿐입니다.
      </p>

      <CollectionFormModal
        key={`edit-${modalKey}`}
        mode="edit"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{ title: data.title, description: data.description }}
        isSubmitting={actions.update.isPending}
        onSubmit={(input) =>
          actions.update.mutate(
            { collectionId: data.collectionId, input },
            {
              onSuccess: () => {
                setEditOpen(false)
                showToast('컬렉션을 수정했습니다')
              },
              // 이름이 겹치면 409 — 모달을 닫지 않아 제목만 고칠 수 있습니다
              onError: (error) =>
                showToast(
                  isApiError(error)
                    ? error.message
                    : '컬렉션을 수정하지 못했습니다',
                ),
            },
          )
        }
      />

      <AddToCollectionModal
        key={`add-${modalKey}`}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        // 진열대에 있고 아직 이 컬렉션에 없는 향수만 후보입니다
        candidates={(shelf.data ?? [])
          .filter((item) => !inCollection.has(item.shelfItemId))
          .map((item) => ({
            shelfItemId: item.shelfItemId,
            name: item.name,
            brand: item.brand,
            thumbnailUrl: item.thumbnailUrl,
          }))}
        isSubmitting={actions.addPerfumes.isPending}
        onSubmit={(shelfItemIds) =>
          actions.addPerfumes.mutate(
            { collectionId: data.collectionId, shelfItemIds },
            {
              onSuccess: (added) => {
                setAddOpen(false)
                showToast(`향수 ${added}개를 추가했습니다`)
              },
              onError: (error) => {
                // 일부만 들어갔으면 들어간 것은 사실이라 모달을 닫고 알립니다
                if (error instanceof CollectionAddPartialError) {
                  setAddOpen(false)
                  showToast(
                    `${error.added}개를 추가했고 ${error.failed}개는 추가하지 못했습니다`,
                  )
                  return
                }
                showToast(
                  isApiError(error)
                    ? error.message
                    : '향수를 추가하지 못했습니다',
                )
              },
            },
          )
        }
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`'${removeTargetName ?? '향수'}' 를 컬렉션에서 제거할까요?`}
        description="진열대 저장은 그대로 유지됩니다."
        confirmLabel="제거"
        onConfirm={() => {
          if (removeTarget === null) return
          setRemoveTarget(null)
          actions.removePerfume.mutate(
            { collectionId: data.collectionId, shelfItemId: removeTarget },
            {
              onSuccess: () => showToast('컬렉션에서 제거했습니다'),
              // 마지막 향수는 서버가 409 로 막습니다 — 서버 문구가 이유를 말해 줍니다
              onError: (error) =>
                showToast(
                  isApiError(error)
                    ? error.message
                    : '컬렉션에서 제거하지 못했습니다',
                ),
            },
          )
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`'${data.title}' 컬렉션을 삭제할까요?`}
        description="삭제하면 되돌릴 수 없습니다. 담긴 향수의 진열대 저장은 유지됩니다."
        isLoading={actions.remove.isPending}
        onConfirm={() =>
          actions.remove.mutate(
            { collectionId: data.collectionId },
            {
              onSuccess: () => navigate(ROUTES.MY_SHELF),
              onError: (error) => {
                setDeleteOpen(false)
                showToast(
                  isApiError(error)
                    ? error.message
                    : '컬렉션을 삭제하지 못했습니다',
                )
              },
            },
          )
        }
      />

      <Toast {...toastProps} />
    </div>
  )
}
