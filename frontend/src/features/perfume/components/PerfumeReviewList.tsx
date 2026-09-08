import { ROUTES } from '@/shared/config/routes'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LinkButton } from '@/shared/ui/LinkButton'

/**
 * 향수 상세 ⑤ 후기 (와이어프레임 A10 — DTL-03 · DTL-10)
 *
 * ⚠️ 후기 목록(DTL-03)이 백엔드에 아직 없어 빈 상태만 보여줍니다.
 */
export function PerfumeReviewList() {
  return (
    <section className="space-y-3 p-6">
      <LinkButton to={ROUTES.REVIEW_WRITE}>후기 쓰기</LinkButton>
      <p className="text-ink-muted text-[10.5px]">
        [후기 쓰기]는 모달이 아니라 후기 게시글 작성 화면으로 이동합니다. 이
        향수가 대상으로 걸린 채 열립니다.
      </p>

      {/* TODO: 백엔드 DTL-03 후기 목록 연결 */}
      <EmptyState
        title="아직 후기가 없습니다"
        description="이 향수를 시향했다면 첫 후기를 남겨보세요."
      />
    </section>
  )
}
