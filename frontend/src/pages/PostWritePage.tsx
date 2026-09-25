import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
        description="글은 로그인한 뒤에 쓸 수 있습니다."
      />
    )
  }

  if (editing && post.isPending) return <PageFallback />

  return (
    <>
      <WriteForm
        title={editing ? '글 수정' : '글쓰기'}
        description="분류는 필수입니다. 컬렉션 공유 글의 향수는 첨부한 컬렉션이 정하고, 그 밖의 분류에서는 직접 고릅니다. 이미지는 없어도 됩니다."
        cancelTo={editing ? toPostDetail(editingId) : ROUTES.COMMUNITY_FREE}
        submitLabel={editing ? '수정' : '포스팅'}
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
            {editing
              ? '글을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.'
              : '글을 올리지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}
        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            분류 <span className="text-danger">*</span>
          </legend>
          <ChipToggle
            label="게시글 분류"
            options={POST_CATEGORIES}
            value={category}
            onChange={(next) => {
              setCategory(next)
              if (next !== 'COLLECTION') releaseCollection()
            }}
          />
        </fieldset>

        <Input
          label="제목"
          placeholder="제목을 입력하세요"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label="본문"
          placeholder="내용을 입력하세요"
          rows={12}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />

        {category === 'COLLECTION' && (
          <fieldset className="space-y-2.5">
            <legend className="text-ink text-caption font-medium">
              컬렉션 첨부
            </legend>
            {collection && (
              <p className="border-line-soft bg-surface-sunken text-ink text-body rounded-card inline-flex w-fit max-w-full items-center gap-2.5 border px-2.5 py-2.5">
                {collection.title}
                <button
                  type="button"
                  aria-label={`${collection.title} 첨부 해제`}
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
              {collection ? '다른 컬렉션 고르기' : '+ 내 컬렉션에서'}
            </Button>
          </fieldset>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            관련 향수{' '}
            <span className="text-ink-muted">
              {fromCollection ? '(컬렉션에 담긴 향수)' : '(선택)'}
            </span>
          </legend>

          {fromCollection && shownPerfumes.length === 0 && (
            <p className="text-ink-muted text-caption">
              {collection
                ? '이 컬렉션에 담긴 향수가 없습니다.'
                : '컬렉션을 첨부하면 그 향수가 여기에 나타납니다.'}
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
                    aria-label={`${perfume.name} 제거`}
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
                + 향수 선택
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
        title="컬렉션 첨부"
        footer={
          <Button variant="outline" onClick={() => setCollectionOpen(false)}>
            닫기
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
            title="만든 컬렉션이 없습니다"
            description="진열대에서 컬렉션을 먼저 만들어 주세요."
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
                    향수 {item.perfumeCount}개
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
