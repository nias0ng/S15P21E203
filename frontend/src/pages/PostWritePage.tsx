import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import {
  collectionDetailQuery,
  myCollectionsQuery,
} from '@/features/collection'
import {
  communityKeys,
  createPost,
  ImageAttachField,
  LinkedPerfumeModal,
  POST_CATEGORIES,
  postDetailQuery,
  updatePost,
  WriteForm,
  type LinkedPerfume,
  type PostCategory,
} from '@/features/community'
import { perfumePickQuery } from '@/features/perfume'
import { ROUTES, toPostDetail, toPostEdit } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { parseId } from '@/shared/lib/parseId'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Modal } from '@/shared/ui/Modal'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Textarea } from '@/shared/ui/Textarea'

export default function PostWritePage() {
  const { t } = useTranslation('community')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLoggedIn = useIsLoggedIn()

  const { postId } = useParams<{ postId: string }>()
  const editingId = parseId(postId)
  const editing = editingId !== null

  const [category, setCategory] = useState<PostCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [perfumes, setPerfumes] = useState<LinkedPerfume[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [collection, setCollection] = useState<{
    collectionId: number
    title: string
  } | null>(null)
  const [collectionOpen, setCollectionOpen] = useState(false)

  const perfumeSearch = useQuery(perfumePickQuery(keyword))

  const collections = useQuery({
    ...myCollectionsQuery(),
    enabled: category === 'COLLECTION',
  })

  const post = useQuery({
    ...postDetailQuery(editingId ?? Number.NaN),
    enabled: editing,
  })

  const [pickedCollectionId, setPickedCollectionId] = useState<number | null>(
    null,
  )

  const pickedCollection = useQuery({
    ...collectionDetailQuery(pickedCollectionId ?? Number.NaN),
    enabled: pickedCollectionId !== null,
  })

  const collectionPerfumes: LinkedPerfume[] | null =
    pickedCollection.data?.perfumes.map((perfume) => ({
      perfumeId: perfume.perfumeId,
      name: perfume.name,
      brand: perfume.brand,
      thumbnailUrl: perfume.thumbnailUrl,
    })) ?? null

  const shownPerfumes = collectionPerfumes ?? perfumes

  const releaseCollection = () => {
    if (collectionPerfumes) setPerfumes(collectionPerfumes)
    setCollection(null)
    setPickedCollectionId(null)
  }

  const [filledFor, setFilledFor] = useState<number | null>(null)
  if (editing && post.data && filledFor !== editingId) {
    setFilledFor(editingId)
    setCategory(post.data.category)
    setTitle(post.data.title)
    setContent(post.data.content)
    setPerfumes(
      post.data.relatedPerfumes.map((perfume) => ({
        perfumeId: perfume.perfumeId,
        name: perfume.name,
        brand: perfume.brand,
      })),
    )
    setImageUrls(post.data.imageUrls)
    setCollection(
      post.data.collectionId !== null && post.data.collectionTitle !== null
        ? {
            collectionId: post.data.collectionId,
            title: post.data.collectionTitle,
          }
        : null,
    )
  }

  const fromCollection = category === 'COLLECTION'

  const save = useMutation({
    mutationFn: async () => {
      if (category === null) throw new Error('분류를 골라야 합니다')

      const perfumeIds = shownPerfumes.map((perfume) => perfume.perfumeId)

      if (editing) {
        const attachedBefore = post.data?.collectionId ?? null
        const attachedNow = collection?.collectionId ?? null

        await updatePost(editingId, {
          category,
          title: title.trim(),
          content: content.trim(),
          ...(attachedNow !== attachedBefore && { collectionId: attachedNow }),
          ...(attachedNow === null && { perfumeIds }),
          imageUrls,
        })
        return editingId
      }

      if (collection) {
        return createPost({
          category,
          title: title.trim(),
          content: content.trim(),
          collectionId: collection.collectionId,
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        })
      }

      return createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        ...(perfumeIds.length > 0 ? { perfumeIds } : {}),
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
      })
    },
    onSuccess: (savedId) => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
      navigate(toPostDetail(savedId), { replace: true })
    },
  })

  if (!isLoggedIn) {
    return (
      <LoginRequiredDialog
        open
        onClose={() => navigate(ROUTES.COMMUNITY_FREE, { replace: true })}
        redirectTo={editing ? toPostEdit(editingId) : ROUTES.POST_WRITE}
        description={t('freeBoard.writeLoginRequired')}
      />
    )
  }

  if (editing && post.isPending) return <PageFallback />

  return (
    <>
      <WriteForm
        title={editing ? t('postWrite.editTitle') : t('postWrite.newTitle')}
        description={t('postWrite.description')}
        cancelTo={editing ? toPostDetail(editingId) : ROUTES.COMMUNITY_FREE}
        submitLabel={
          editing ? t('postWrite.submitEdit') : t('postWrite.submitNew')
        }
        submitDisabled={
          category === null ||
          title.trim().length === 0 ||
          content.trim().length === 0 ||
          save.isPending
        }
        onSubmit={() => save.mutate()}
      >
        {save.isError && (
          <p role="alert" className="text-danger text-body">
            {editing ? t('postWrite.editFailed') : t('postWrite.createFailed')}
          </p>
        )}
        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            {t('postWrite.category')} <span className="text-danger">*</span>
          </legend>
          <ChipToggle
            label={t('postWrite.categoryGroup')}
            options={POST_CATEGORIES.map((option) => ({
              value: option.value,
              label: t(`categories.${option.value}`),
            }))}
            value={category}
            onChange={(next) => {
              setCategory(next)
              if (next !== 'COLLECTION') releaseCollection()
            }}
          />
        </fieldset>

        <Input
          label={t('postWrite.title')}
          placeholder={t('postWrite.titlePlaceholder')}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label={t('postWrite.content')}
          placeholder={t('postWrite.contentPlaceholder')}
          rows={12}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        {category === 'COLLECTION' && (
          <fieldset className="space-y-2.5">
            <legend className="text-ink text-caption font-medium">
              {t('postWrite.collection')}
            </legend>
            {collection && (
              <p className="border-line-soft bg-surface-sunken text-ink text-body rounded-card inline-flex w-fit max-w-full items-center gap-2.5 border px-2.5 py-2.5">
                {collection.title}
                <button
                  type="button"
                  aria-label={t('postWrite.releaseCollection', {
                    title: collection.title,
                  })}
                  onClick={releaseCollection}
                  className={cn(
                    'text-ink-muted hover:text-ink rounded-card',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                  )}
                >
                  <span aria-hidden>×</span>
                </button>
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setCollectionOpen(true)}
            >
              {collection
                ? t('postWrite.otherCollection')
                : t('postWrite.fromMyCollections')}
            </Button>
          </fieldset>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            {t('postWrite.perfumes')}{' '}
            <span className="text-ink-muted">
              {fromCollection
                ? t('postWrite.perfumesFromCollection')
                : t('postWrite.optional')}
            </span>
          </legend>

          {fromCollection && shownPerfumes.length === 0 && (
            <p className="text-ink-muted text-caption">
              {collection
                ? t('postWrite.collectionEmpty')
                : t('postWrite.collectionHint')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {shownPerfumes.map((perfume) => (
              <span
                key={perfume.perfumeId}
                className="border-line-soft bg-surface-sunken text-ink text-caption rounded-card flex items-center gap-2.5 border px-2.5 py-2.5"
              >
                {perfume.name}
                {!fromCollection && (
                  <button
                    type="button"
                    aria-label={t('postWrite.removePerfume', {
                      name: perfume.name,
                    })}
                    onClick={() =>
                      setPerfumes((prev) =>
                        prev.filter(
                          (item) => item.perfumeId !== perfume.perfumeId,
                        ),
                      )
                    }
                    className={cn(
                      'text-ink-muted hover:text-ink rounded-card',
                      'transition-colors duration-120 ease-out',
                      'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    )}
                  >
                    <span aria-hidden>×</span>
                  </button>
                )}
              </span>
            ))}
            {!fromCollection && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPickOpen(true)}
              >
                {t('postWrite.pickPerfume')}
              </Button>
            )}
          </div>
        </fieldset>

        <ImageAttachField value={imageUrls} onChange={setImageUrls} />
      </WriteForm>

      <LinkedPerfumeModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        candidates={perfumeSearch.data ?? []}
        isPending={perfumeSearch.isFetching}
        onSearch={setKeyword}
        onSubmit={(picked) => {
          setPerfumes((prev) => [
            ...prev,
            ...picked.filter(
              (item) =>
                !prev.some((existing) => existing.perfumeId === item.perfumeId),
            ),
          ])
          setPickOpen(false)
        }}
      />

      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title={t('postWrite.collection')}
        footer={
          <Button variant="outline" onClick={() => setCollectionOpen(false)}>
            {t('postWrite.close')}
          </Button>
        }
      >
        {collections.isPending ? (
          <ul className="space-y-1.25">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-12.5 w-full" />
              </li>
            ))}
          </ul>
        ) : (collections.data?.length ?? 0) === 0 ? (
          <EmptyState
            title={t('postWrite.noCollectionsTitle')}
            description={t('postWrite.noCollectionsDescription')}
          />
        ) : (
          <ul className="max-h-72.5 space-y-1.25 overflow-y-auto">
            {(collections.data ?? []).map((item) => (
              <li key={item.collectionId}>
                <button
                  type="button"
                  aria-pressed={collection?.collectionId === item.collectionId}
                  onClick={() => {
                    setCollection({
                      collectionId: item.collectionId,
                      title: item.title,
                    })
                    setPickedCollectionId(item.collectionId)
                    setCollectionOpen(false)
                  }}
                  className={cn(
                    'hover:bg-line-soft flex w-full flex-col items-start gap-1.25 p-2.5 text-left',
                    'transition-colors duration-120 ease-out',
                    'focus-visible:ring-accent-deep outline-none focus-visible:ring-2',
                    collection?.collectionId === item.collectionId &&
                      'bg-line-soft',
                  )}
                >
                  <span className="text-ink text-body font-medium">
                    {item.title}
                  </span>
                  <span className="text-ink-muted text-caption">
                    {t('postWrite.perfumeCount', { count: item.perfumeCount })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
