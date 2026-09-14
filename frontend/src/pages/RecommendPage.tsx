import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { MiniMap, mapPointsQuery, ScentMap } from '@/features/map'
import { RecommendResultList, recommendationQuery } from '@/features/recommend'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { PageFallback } from '@/shared/ui/PageFallback'

/**
 * 자연어 추천 결과 (와이어프레임 A06 — NLR-01 · NLR-06 · NLR-07)
 *
 * 배경에 향 지도를 흐리게 깔고 결과 카드와 미니 맵을 그 위에 얹습니다.
 * 입력한 말은 URL 쿼리(`?q=`)에 둡니다 — 링크를 공유하면 같은 결과가 나옵니다.
 */
export default function RecommendPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  const [draft, setDraft] = useState(query)
  const [editing, setEditing] = useState(query.length === 0)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)

  const result = useQuery({
    ...recommendationQuery(query),
    enabled: query.trim().length > 0,
  })
  const points = useQuery(mapPointsQuery())

  if (query && result.isPending) return <PageFallback />

  const perfumes = result.data?.perfumes ?? []

  return (
    <div className="relative">
      {/* 배경은 향 지도 — 흐리게 깔립니다 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <ScentMap points={points.data ?? []} zoom={1} dimmed />
      </div>

      <div className="space-y-4 py-4">
        {/* 입력한 말 */}
        <div className="border-line bg-surface-card/95 space-y-2 border p-3 backdrop-blur">
          <p className="text-ink-muted text-[10.5px]">입력한 말</p>
          {editing ? (
            <form
              className="flex items-start gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = draft.trim()
                if (!trimmed) return
                setSearchParams({ q: trimmed })
                setEditing(false)
              }}
            >
              <div className="flex-1">
                <Input
                  label="어떤 향을 찾고 계신가요"
                  hideLabel
                  placeholder="어떤 향을 찾고 계신가요"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <Button type="submit">찾기</Button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-ink flex-1 text-sm">&ldquo;{query}&rdquo;</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(query)
                  setEditing(true)
                }}
              >
                다시 입력
              </Button>
            </div>
          )}
        </div>

        {query && perfumes.length === 0 ? (
          <EmptyState
            title="조건에 맞는 향수를 찾지 못했습니다"
            description="다른 표현으로 다시 입력해 보세요."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(query)
                  setEditing(true)
                }}
              >
                다시 입력
              </Button>
            }
          />
        ) : (
          query && (
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
              <RecommendResultList
                perfumes={perfumes}
                selectedId={highlightedId}
                onSelect={setHighlightedId}
              />

              <div className="space-y-2">
                {/* 조작은 미니 맵에서 합니다 */}
                <MiniMap
                  points={perfumes.map((perfume) => ({
                    perfumeId: perfume.perfumeId,
                    name: perfume.name,
                    brand: perfume.brand,
                    region: 'WOODY' as const,
                    x: perfume.x,
                    y: perfume.y,
                  }))}
                  viewport={{ x: 0, y: 0, width: 100, height: 100 }}
                  numberedPoints={perfumes.map((perfume, index) => ({
                    perfumeId: perfume.perfumeId,
                    label: String(index + 1),
                  }))}
                  highlightedId={highlightedId}
                />
                <p className="text-ink-muted text-[10.5px]">
                  추천 향수 {perfumes.length}개가 지도에서 어디쯤인지
                  보여줍니다.
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
