import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { myCollectionsQuery } from '@/features/collection'
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
import { ROUTES, toPostDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { ChipToggle } from '@/shared/ui/ChipToggle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Textarea } from '@/shared/ui/Textarea'

/**
 * 자유 게시글 작성 · 수정 (와이어프레임 A24b — CMT-03 · CMT-06 · CMT-16)
 *
 * 분류는 필수이고, 컬렉션 첨부는 "컬렉션 공유" 를 골랐을 때만 나타납니다.
 * [포스팅] 하면 게시글 상세(A23)로 갑니다.
 *
 * **수정도 같은 화면입니다** — 주소에 글 번호가 있으면(`POST_EDIT`) 수정입니다.
 * 후기 쓰기(A24a)와 같은 방식입니다.
 */
export default function PostWritePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { postId } = useParams<{ postId: string }>()
  const editingId = postId === undefined ? null : Number(postId)
  const editing = editingId !== null && Number.isFinite(editingId)

  const [category, setCategory] = useState<PostCategory | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [perfumes, setPerfumes] = useState<LinkedPerfume[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [collection, setCollection] = useState<{
    collectionId: number
    title: string
  } | null>(null)
  const [collectionOpen, setCollectionOpen] = useState(false)

  /*
    향수 후보는 이 화면이 만듭니다 — `features/community` 는 `features/perfume` 을
    import 할 수 없어(ESLint 레이어 규칙) 모달이 스스로 검색할 수 없습니다.

    검색어를 치기 전에는 부르지 않습니다. 조건 없이 부르면 카탈로그 7,793개의 첫
    쪽이 후보로 뜨는데, 그건 "고를 향수" 가 아니라 그냥 목록입니다.
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
    고칠 글이 도착하면 칸을 한 번 채웁니다. `useEffect` 가 아니라 렌더 중에 맞추는
    이유는 한 박자 늦게 채우면 첫 프레임에 빈 칸이 보여서입니다. 채운 뒤에는 사람이
    고친 값이 이깁니다 — 열쇠(글 번호)가 그대로면 다시 덮어쓰지 않습니다.
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
  }

  const save = useMutation({
    mutationFn: async () => {
      if (category === null) throw new Error('분류를 골라야 합니다')

      const perfumeIds = perfumes.map((perfume) => perfume.perfumeId)

      if (editing) {
        /*
          보낸 항목만 바뀝니다. 향수는 **목록 통째로** 바뀌므로 화면이 들고 있는
          전부를 보냅니다(하나를 빼면 나머지 전부가 그대로 올라갑니다).
          컬렉션은 보내지 않습니다 — 보내면 서버가 컬렉션을 다시 읽어, 제목만
          고쳤는데 향수가 바뀌는 일이 생깁니다.
        */
        await updatePost(editingId, {
          category,
          title: title.trim(),
          content: content.trim(),
          perfumeIds,
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
        })
      }

      return createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        ...(perfumeIds.length > 0 ? { perfumeIds } : {}),
      })
    },
    onSuccess: (savedId) => {
      // 목록의 제목 · 향수와 상세가 함께 낡습니다
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
      navigate(toPostDetail(savedId), { replace: true })
    },
  })

  // 고칠 글을 받아오는 동안은 빈 칸을 보여주지 않습니다
  if (editing && post.isPending) return <PageFallback />

  return (
    <>
      <WriteForm
        title={editing ? '글 수정' : '글쓰기'}
        description="분류는 필수입니다. 컬렉션 첨부는 컬렉션 공유를 골랐을 때만 나타나고, 관련 향수와 이미지는 없어도 됩니다."
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
            onChange={setCategory}
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
                  onClick={() => setCollection(null)}
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
            {/*
              컬렉션을 붙이면 향수를 따로 걸 수 없습니다(서버가 400 으로 막습니다) —
              그 컬렉션의 향수가 곧 글의 향수입니다.
            */}
            {collection && perfumes.length > 0 && (
              <p className="text-ink-muted text-caption">
                컬렉션을 붙이면 아래에서 고른 향수는 글에 걸리지 않습니다.
              </p>
            )}
          </fieldset>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-ink text-caption font-medium">
            관련 향수 <span className="text-ink-muted">(선택)</span>
          </legend>
          <div className="flex flex-wrap items-center gap-2.5">
            {perfumes.map((perfume) => (
              <span
                key={perfume.perfumeId}
                className="border-line-soft bg-surface-sunken text-ink text-caption rounded-card flex items-center gap-2.5 border px-2.5 py-2.5"
              >
                {perfume.name}
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
              </span>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setPickOpen(true)}
            >
              + 향수 선택
            </Button>
          </div>
        </fieldset>

        <ImageAttachField />
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
