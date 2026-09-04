import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { perfumeDetailQuery } from '@/features/perfume/queries'
import { PageFallback } from '@/shared/ui/PageFallback'

/**
 * 향수 상세 화면 (기능 명세: DTL-01, DTL-02, DTL-10)
 * features/ 슬라이스를 화면에서 어떻게 쓰는지 보여주는 참고 구현입니다.
 */
export default function PerfumeDetailPage() {
  const { perfumeId } = useParams<{ perfumeId: string }>()
  const { data, isPending, isError, error } = useQuery({
    ...perfumeDetailQuery(Number(perfumeId)),
    enabled: Number.isFinite(Number(perfumeId)),
  })

  if (isPending) return <PageFallback />
  if (isError) {
    return <p className="text-sm text-red-600">{error.message}</p>
  }

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <p className="text-ink-muted text-sm">{data.brand}</p>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-ink-muted text-sm">
          평점 {data.averageScore.toFixed(1)} · 후기 {data.reviewCount}개
        </p>
      </header>

      <p className="leading-relaxed">{data.description}</p>

      <dl className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['탑 노트', data.notes.top],
            ['미들 노트', data.notes.middle],
            ['베이스 노트', data.notes.base],
          ] as const
        ).map(([label, notes]) => (
          <div key={label} className="bg-brand-50 rounded-card p-4">
            <dt className="text-ink-muted text-xs">{label}</dt>
            <dd className="mt-1 text-sm">{notes.join(', ')}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
