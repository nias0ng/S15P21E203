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
import { perfumeListQuery } from '@/features/perfume'
import { ROUTES, toPostDetail, toPostEdit } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
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

/**
 * 자유 게시글 작성 · 수정 (A24b — CMT-03 · 06 · 16)
 *
 * 분류는 필수이고, 컬렉션 첨부는 "컬렉션 공유" 를 골랐을 때만 나타납니다.
 * **수정도 같은 화면입니다** — 주소에 글 번호가 있으면(`POST_EDIT`) 수정입니다.
 */
export default function PostWritePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isLoggedIn = useIsLoggedIn()

  const { postId } = useParams<{ postId: string }>()
  const editingId = postId === undefined ? null : Number(postId)
  const editing = editingId !== null && Number.isFinite(editingId)

  const [category, setCategory] = useState<PostCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [perfumes, setPerfumes] = useState<LinkedPerfume[]>([])
  /** 미리 올려 둔 사진 주소. 글을 저장할 때 통째로 보냅니다 */
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [collection, setCollection] = useState<{
    collectionId: number
    title: string
  } | null>(null)
  const [collectionOpen, setCollectionOpen] = useState(false)

  /*
    향수 후보는 이 화면이 만듭니다 — 모달은 `features/perfume` 을 import 할 수
    없습니다(ESLint). 검색어를 치기 전에는 부르지 않습니다.
  */
  const perfumeSearch = useQuery({
    ...perfumeListQuery({ keyword, size: 20 }),
    enabled: keyword.trim().length > 0,
  })

  const candidates: LinkedPerfume[] = (perfumeSearch.data?.perfumes ?? []).map(
    (perfume) => ({
      perfumeId: perfume.perfumeId,
      // 한국어 이름이 없는 향수가 있습니다 — 그때는 영문으로 부릅니다
      name: perfume.nameKo ?? perfume.name,
      brand: perfume.brandName ?? perfume.brandNameKo,
      thumbnailUrl: perfume.imageUrl,
    }),
  )

  /** 컬렉션 공유 글에 붙일 내 컬렉션. 로그인해야 옵니다 */
  const collections = useQuery({
    ...myCollectionsQuery(),
    enabled: category === 'COLLECTION',
  })

  const post = useQuery({
    ...postDetailQuery(editingId ?? Number.NaN),
    enabled: editing,
  })

  /*
    **사람이 방금 고른** 컬렉션입니다. 고칠 글에서 되살린 첨부는 여기 들어오지
    않습니다 — 글의 향수는 쓸 때 박제된 것이라, 지금의 컬렉션으로 덮으면 그 사이
    컬렉션에서 뺀 향수가 글에서도 사라진 것처럼 보입니다.
  */
  const [pickedCollectionId, setPickedCollectionId] = useState<number | null>(
    null,
  )

  const pickedCollection = useQuery({
    ...collectionDetailQuery(pickedCollectionId ?? Number.NaN),
    enabled: pickedCollectionId !== null,
  })

  /**
   * 고른 컬렉션이 정하는 향수. **상태로 베끼지 않고 파생 값으로 둡니다** — 한 번만
   * 채우는 방식이면 "이미 채웠다" 표시가 남아, 분류를 옮겼다 돌아와 같은 컬렉션을
   * 다시 골랐을 때 아무 일도 일어나지 않습니다.
   */
  const collectionPerfumes: LinkedPerfume[] | null =
    pickedCollection.data?.perfumes.map((perfume) => ({
      perfumeId: perfume.perfumeId,
      name: perfume.name,
      brand: perfume.brand,
      thumbnailUrl: perfume.thumbnailUrl,
    })) ?? null

  /** 화면에 그리고 서버로 보낼 향수. 컬렉션이 정하면 그것, 아니면 직접 고른 것 */
  const shownPerfumes = collectionPerfumes ?? perfumes

  /** 컬렉션을 뗄 때, 컬렉션이 정하던 향수를 직접 고른 것으로 넘겨받습니다 */
  const releaseCollection = () => {
    if (collectionPerfumes) setPerfumes(collectionPerfumes)
    setCollection(null)
    setPickedCollectionId(null)
  }

  /*
    고칠 글이 도착하면 칸을 한 번 채웁니다. 렌더 중에 맞추는 이유: `useEffect` 는
    한 박자 늦어 첫 프레임에 빈 칸이 보입니다. 채운 뒤에는 사람이 고친 값이 이깁니다.
  */
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
    /*
      붙어 있던 컬렉션도 되살립니다. 안 되살리면 화면이 "첨부 없음" 으로 보이고,
      아래 저장이 폼을 기준으로 판단하므로 **떼라는 요청으로 읽혀 컬렉션이 날아갑니다.**
    */
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

  /** 향수를 컬렉션이 정하는 상태. 이때는 고르지도 빼지도 못합니다 */
  const fromCollection = category === 'COLLECTION'

  const save = useMutation({
    mutationFn: async () => {
      if (category === null) throw new Error('분류를 골라야 합니다')

      const perfumeIds = shownPerfumes.map((perfume) => perfume.perfumeId)

      if (editing) {
        const attachedBefore = post.data?.collectionId ?? null
        const attachedNow = collection?.collectionId ?? null

        /*
          **컬렉션이 붙어 있으면 향수를 함께 보낼 수 없습니다**(400) — 향수 출처가
          컬렉션이라서입니다. 늘 보내고 있던 탓에 컬렉션 글은 수정이 100% 실패했습니다.

          컬렉션은 **바뀐 때만** 보냅니다. 그대로 보내면 서버가 컬렉션을 다시 읽어,
          제목만 고쳤는데 향수가 바뀝니다. 뗐을 때는 `null` 을 보내야 하고, 그래야
          같은 요청의 향수 목록이 받아들여집니다(서버가 컬렉션을 먼저 처리합니다).
        */
        await updatePost(editingId, {
          category,
          title: title.trim(),
          content: content.trim(),
          ...(attachedNow !== attachedBefore && { collectionId: attachedNow }),
          // 향수는 **목록 통째로** 바뀌므로 보낼 때는 전부 보냅니다
          ...(attachedNow === null && { perfumeIds }),
          // 사진도 보낸 목록으로 통째로 바뀝니다 — 지운 것까지 그대로 반영됩니다
          imageUrls,
        })
        return editingId
      }

      /*
        컬렉션과 향수는 **함께 보낼 수 없습니다**(400). 컬렉션을 붙이면 그 컬렉션의
        향수가 곧 글의 향수라서, 목록을 따로 보낼 자리가 없습니다.
      */
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
      // 목록의 제목 · 향수와 상세가 함께 낡습니다
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
      navigate(toPostDetail(savedId), { replace: true })
    },
  })

  /*
    주소로 바로 들어오거나 즐겨찾기로 열면 단추를 거치지 않습니다. 빈 칸을 다 채우고
    [포스팅] 에서야 막히면 쓴 것을 잃으므로 여기서도 한 번 더 봅니다.
  */
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

  // 고칠 글을 받아오는 동안은 빈 칸을 보여주지 않습니다
  if (editing && post.isPending) return <PageFallback />

  return (
    <>
      <WriteForm
        title={editing ? '글 수정' : '글쓰기'}
        description="분류는 필수입니다. 컬렉션 공유 글의 향수는 첨부한 컬렉션이 정하고, 그 밖의 분류에서는 직접 고릅니다. 이미지는 없어도 됩니다."
        cancelTo={editing ? toPostDetail(editingId) : ROUTES.COMMUNITY_FREE}
        submitLabel={editing ? '수정' : '포스팅'}
        /*
          분류 · 제목 · 내용이 필수입니다(서버도 @NotBlank 로 막습니다).
          보내는 중에는 다시 누르지 못하게 합니다 — 글이 둘 만들어집니다.
        */
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
        {/*
          fieldset 과 legend 로 묶습니다. 예전에는 `<span>분류</span>` 였는데,
          낭독기에는 칩 세 개가 무엇을 고르는 것인지 전해지지 않았습니다.
        */}
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
              /*
                컬렉션 첨부 칸은 '컬렉션 공유' 에서만 보입니다. 분류를 옮길 때
                풀지 않으면 **보이지 않는 채로 글에 붙고**, 거기에 향수까지 고르면
                서버가 400 으로 막습니다.
              */
              if (next !== 'COLLECTION') releaseCollection()
            }}
          />
        </fieldset>

        {/*
          라벨을 보이게 두었습니다. placeholder 로만 알려주면 한 글자라도 치는
          순간 무엇을 적는 칸인지 사라집니다.
        */}
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

        {/* 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타납니다 */}
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
                  className="text-ink-muted hover:text-ink"
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

        {/*
          **컬렉션 공유 글에서는 향수를 고르지 않습니다** — 첨부한 컬렉션의 향수가
          곧 글의 향수입니다(서버가 둘을 함께 받으면 400). 예전에는 고를 수는 있고
          "글에 걸리지 않습니다" 라고 알리기만 했는데, 고를 수 있는데 안 걸리는 것이
          더 헷갈립니다.
        */}
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

      {/*
        후보 목록은 이 화면에서 넘깁니다. features 끼리는 import 할 수 없으므로
        향수 검색 결과를 여기서 조합해야 합니다.
      */}
      <LinkedPerfumeModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        candidates={candidates}
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

      {/*
        컬렉션 고르기. 모달 하나짜리라 컴포넌트를 따로 만들지 않고 여기 둡니다 —
        컬렉션 도메인에 두면 이 화면만 쓰는 것이 도메인 공개 API 로 나갑니다.
      */}
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
                    // 이 컬렉션의 향수가 곧 글의 향수입니다 — 받아서 아래에 채웁니다
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
