type Props = {
  /** 브랜드 공식 향 설명. 없는 향수는 null 로 옵니다 */
  description: string | null
}

/**
 * 향수 상세 ④ AI 후기 요약 + 브랜드 공식 향 설명 (와이어프레임 A10 — DTL-23)
 *
 * 와이어프레임에서 두 글 덩어리가 한 구역의 2열이라 함께 둡니다.
 *
 * ⚠️ AI 요약(DTL-23)은 백엔드가 아직 없어 안내 문구만 보여줍니다.
 */
export function PerfumeReviewSummary({ description }: Props) {
  return (
    <section className="grid gap-6 p-6 sm:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-ink text-sm font-bold">AI 후기 요약</h2>
        {/* TODO: 백엔드 DTL-23 응답 연결 */}
        <p className="text-ink-muted text-xs leading-relaxed">
          후기가 충분히 쌓이면 요약을 보여드립니다.
        </p>
        <p className="text-ink-muted text-[10.5px] leading-relaxed">
          후기를 AI가 요약해 문장으로 보여줍니다. 퍼센트는 문장 안의 수치로만
          쓰고 막대는 쓰지 않습니다. 호평 · 혹평을 섞어 4문장까지 보여주고, 후기
          수가 적으면 요약을 생성하지 않습니다.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-ink text-sm font-bold">브랜드 공식 향 설명</h2>
        <p className="text-ink text-xs leading-relaxed">
          {description ?? '아직 등록된 설명이 없습니다.'}
        </p>
      </div>
    </section>
  )
}
