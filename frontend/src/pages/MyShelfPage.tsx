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
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/*
 * ⚠️ 이 화면만 공통 규칙 두 가지를 벗어납니다 — 왜인가
 *
 * 1) 바탕색이 @theme 토큰이 아니라 시안 실측값(#eee7dc)입니다.
 *    Museum Archive 의 surface(ivory #f9f6ef)는 시안의 크림보다 밝고 차가워서,
 *    그 위에 올리면 진열장(#e5dcce)과 바탕의 명도 차가 사라져 진열장이 종이에
 *    묻힙니다. 그렇다고 @theme 을 시안에 맞추면 진열대와 무관한 화면 색까지 전부
 *    함께 움직이므로, **시안 확정 전 프로토타입인 이 화면에 한해** 값을 직접
 *    적습니다. 시안이 확정되면 이 값을 @theme 으로 승격시키고 주석을 지웁니다.
 *    (같은 이유로 DisplayCase · CollectionDetailPanel 도 시안 색을 직접 씁니다.)
 *
 *    보조 글자색도 같은 이유로 토큰을 벗어납니다 — 아래 MUTED_INK 주석 참고.
 *
 * 2) 활자 중 제목 하나만 임의 크기(text-[40px])입니다. 시안의 제목이 40px 인데
 *    스케일의 최대치인 text-display 가 28px 이라 어느 토큰으로도 그 크기가 나오지
 *    않습니다. 이 화면에서 가장 큰 글자라 한 단만 어긋나도 위계가 눈에 띄게
 *    달라져 여기만 값을 적고 나머지 활자는 전부 토큰을 씁니다. leading-[1.2] 는
 *    --text-display--line-height 와 같은 비율이라 스케일을 벗어난 값이 아닙니다.
 *
 *    자간(tracking-[0.18em])도 @theme 에 토큰이 없어 임의값입니다 — 값을 쓰는
 *    자리에 이유를 적어 두었습니다.
 *
 * 간격(4의 배수)과 전환(duration+ease)은 규약 그대로입니다. 포커스 링도 굵기 · 색 ·
 * 오프셋 폭은 규약 그대로이고, 크림 바탕 때문에 오프셋 **색** 하나만 더합니다
 * (아래 "+ 향수 등록" 버튼 주석).
 */

/**
 * 부모 <main> 의 max-w-content(1120px) 제약을 이 화면에서만 깹니다.
 *
 * 시안의 진열장은 뷰포트 폭의 76%(1440 기준 1099px)를 쓰고 그 오른쪽에 패널이 또 한 칸
 * 붙습니다. 1120px 안에 우겨넣으면 진열장이 목록 카드만 해지고, 병 130px + 간격 24px
 * 기준으로 다섯 개밖에 안 서서 "미술관 진열장" 이라는 화면의 성격 자체가 사라집니다.
 * RootLayout 주석도 화면을 꽉 채워야 하는 화면은 페이지 안에서 폭 제한을 벗어난다고
 * 적어 두었습니다.
 *
 * 계산: 폭은 좌우 32px 여백을 뺀 값이되 1560px 을 넘지 않고, 좌우 마진
 * calc(50% - 폭/2) 가 부모 중앙을 기준으로 다시 가운데를 잡습니다(부모가 이미
 * mx-auto 라 결과는 뷰포트 정중앙입니다).
 *
 * 흔한 `left-1/2 -translate-x-1/2` 대신 마진으로 미는 이유: 이 div 안에 Toast(fixed)가
 * 들어 있어서 조상에 transform 이 생기면 토스트가 뷰포트가 아니라 이 상자를 기준으로
 * 붙습니다. w-screen 을 쓰지 않은 이유도 같은 종류입니다 — 100vw 는 세로 스크롤바
 * 폭까지 세어 아래 "내 컬렉션" 이 생기는 순간 가로 스크롤이 납니다.
 */
const FULL_BLEED =
  'w-[min(1560px,calc(100vw_-_4rem))] mx-[calc(50%_-_min(780px,calc(50vw_-_2rem)))]'

/**
 * 크림 바탕 위의 보조 글자색.
 *
 * text-ink-muted(#727170)를 쓰지 않은 이유: 그 색의 4.51:1 은 ivory(#f9f6ef) 위에서
 * 잰 값입니다. 이 화면 바탕(#eee7dc)은 ivory 보다 어두워서 같은 색이 약 3.96:1 로
 * 떨어져 본문 대비 기준(4.5:1)에 미달합니다. 바탕에 맞춰 한 단 어둡게 잡은 따뜻한
 * 회색이고 이 바탕 위에서 약 4.9:1 입니다. DisplayCase 의 라벨도 같은 값을 씁니다 —
 * 시안이 확정되면 세 파일의 색을 함께 @theme 으로 올립니다.
 */
const MUTED_INK = 'text-[#6b6252]'

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
    // -my-8 py-4 는 부모 <main> 의 세로 여백(py-8)을 걷어내고 더 좁게 다시 줍니다.
    // 시안은 머리말부터 하단 문구까지가 한 화면에 들어가는 구성이라, 부모 여백을
    // 그대로 두면 그 32px 이 그대로 아래로 밀려 스크롤이 생깁니다.
    <div className={cn(FULL_BLEED, '-my-8 py-4')}>
      {/*
        시안의 크림 바탕. fixed 로 뷰포트를 통째로 덮습니다 — 이 div 에만 배경을 깔면
        좌우 여백과 화면 아래쪽이 body 의 ivory 로 남아 종이 한 장 느낌이 끊깁니다.
        -z-10 이라 본문 뒤, 헤더(bg-surface · z-20) 아래에 깔립니다.
      */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#eee7dc]" />

      {/*
        여기부터 하단 문구까지가 시안의 "한 화면" 입니다. 화면이 남으면
        justify-between 이 남는 세로 공간을 세 덩어리 사이에 나눠, 하단 문구 줄이
        시안(y 865/941)처럼 화면 맨 아래에 붙습니다. 모자라면 그냥 gap-6 로 흐르고
        스크롤됩니다 — 높이를 고정해 내용을 잘라내지는 않습니다.
        6rem 은 헤더(52px)와 위 py-4 두 겹(32px)을 뺀 값에 여유를 조금 더한 값입니다.
      */}
      <section className="flex flex-col gap-6 lg:min-h-[calc(100dvh_-_6rem)] lg:justify-between">
        {/* 머리말과 필터가 한 줄에 놓입니다 (시안: 둘 다 y 145~190) */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/*
            시안의 순서는 제목 → 부제 → 영문 문구입니다. 영문 문구가 맨 위에 있으면
            그게 화면의 제목처럼 읽혀서 시안 순서로 되돌렸습니다.
            제목·부제는 한 덩어리(gap-2)이고 영문 문구만 gap-6 으로 떨어뜨려
            "제목의 일부가 아니라 장식" 이라는 것을 간격으로 말합니다.
          */}
          <header className="flex shrink-0 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-ink font-serif text-[40px] leading-[1.2] font-semibold">
                나의 향 컬렉션
              </h1>
              <p className={cn('text-body', MUTED_INK)}>
                수집한 향들이 모여,
                <br />
                나라는 이야기가 됩니다.
              </p>
            </div>

            {/*
              `tracking-[0.18em]` 만 임의값입니다. @theme 에 자간 토큰이 없고, 자간은
              색 · 크기와 달리 시안이 확정돼도 함께 갈아끼울 대상이 아니라 토큰을 새로
              파지 않았습니다. CollectionDetailPanel 의 SPACED_LABEL 과 같은 값입니다 —
              자간 토큰이 생기면 두 곳을 함께 고칩니다.
            */}
            <p
              className={cn(
                'text-caption tracking-[0.18em] uppercase',
                MUTED_INK,
              )}
            >
              Every scent
              <br />
              has a story
            </p>
          </header>

          {/*
            lg:pt-2 는 칩 줄(약 34px)의 가운데를 40px 제목의 가운데에 맞추는 값입니다.
            items-start 라 그냥 두면 칩이 제목 윗선에 붙어 한 줄로 안 읽힙니다.
          */}
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
            className="flex-1 lg:pt-2"
          />
        </div>

        {/* 진열장과 상세 패널. 시안의 둘 사이가 17px 이라 gap-4 입니다 */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-4">
          <DisplayCase
            items={visible}
            selectedId={selected?.shelfItemId ?? null}
            onSelect={(item) => setSelectedId(item.shelfItemId)}
            className="min-w-0 flex-1"
          />

          {/*
            폭 250px 과 lg:-mt-8 은 레퍼런스 실측입니다.

            폭: 패널이 x 1163~1413(1440 환산)에 서므로 250px 입니다. 앞서 적혀 있던
            300px 은 실측이 아니었고, 그만큼 진열장이 좁아져 위 FULL_BLEED 주석이 목표로
            적어 둔 "뷰포트 폭의 76%(1099px)" 가 나오지 않았습니다 — 1376 - 간격 16 -
            300 = 1060px(73.6%). 250 이면 1110px(77%)로 실측과 맞습니다.

            ⚠️ 이 폭에서 CollectionDetailPanel 의 향조 원 세 개(64px 셋 + 간격 24px 둘 =
            240px)가 패널 안쪽 폭(250 - 좌우 여백 48 = 202px)을 넘어 두 줄로 접힙니다.
            시안은 한 줄이므로 **그 파일의 원 지름과 간격을 줄여야** 합니다. 폭을 여기서
            300 으로 되돌려 맞추면 진열장이 다시 실측을 벗어납니다.

            위치: 시안에서 패널은 진열장보다 위에서 시작해(패널 y 206 · 진열장 y 311)
            필터 줄 바로 아래에 붙습니다. 음수 마진으로 그 차이를 흉내 내되, 필터 줄과
            겹치지 않을 만큼만 올립니다.
          */}
          <CollectionDetailPanel
            item={selected}
            onClose={() => setSelectedId(null)}
            onSave={() => showToast('나의 향수로 저장했습니다')}
            className="w-full shrink-0 lg:-mt-8 lg:w-[250px]"
          />
        </div>

        <CollectionFooterStrip
          index={visible.length === 0 ? 0 : current + 1}
          total={visible.length}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      </section>

      {/*
        내 컬렉션 — 시안에는 없지만 A13 의 아래 절반이라 지우지 않고 그대로 둡니다.
        위 한 화면 구성이 깨지지 않게 하단 문구 줄 아래로 완전히 내리고, mt-16 으로
        "스크롤해서 만나는 다음 장" 이라는 것을 간격으로 알립니다.
      */}
      <section className="mt-16 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-title font-serif font-semibold">
            내 컬렉션
          </h2>
          <span className={cn('text-caption', MUTED_INK)}>
            {collections.data?.length ?? 0}개
          </span>
          {/*
            굵기 · 색 · 오프셋 폭은 공용 버튼 규칙 그대로이고 오프셋 **색**만 더합니다.
            `ring-offset-*` 의 기본색은 흰색이라, 이 크림 바탕 위에서는 링과 버튼 사이
            2px 이 흰 줄로 떠서 종이에 흰 자국이 난 것처럼 보입니다. 바탕을 토큰 밖 색으로
            바꾼 이 화면에서만 생기는 문제라 여기서 오프셋 색을 맞춥니다 —
            CollectionDetailPanel 이 자기 카드 바탕(#ece5da)에 대해 하는 것과 같습니다.

            ⚠️ 위 배경의 bg-[#eee7dc] 와 같은 값입니다. 한쪽만 바꾸면 흰 줄이 다시 생깁니다.
          */}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto focus-visible:ring-offset-[#eee7dc]"
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
