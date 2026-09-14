package com.hyanghae.backend.review.repository;

import com.hyanghae.backend.perfume.repository.ReviewContent;
import com.hyanghae.backend.perfume.repository.ReviewSummaryTarget;
import com.hyanghae.backend.perfume.repository.SeasonCount;
import com.hyanghae.backend.review.entity.PerfumeReview;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 통계 조회와 요약 대상 조회입니다.
 *
 * <p>향수에 달린 후기를 전부 셉니다. 후기는 존재하거나 삭제되거나 둘 중 하나이고 그 사이
 * 상태가 없습니다. 보류와 비공개 개념이 모두 없어지면서 {@code perfume_reviews.status} 도
 * 사라질 예정이라, 앞으로도 걸러낼 후기가 생기지 않습니다.
 */
public interface PerfumeReviewRepository extends JpaRepository<PerfumeReview, Long> {

    boolean existsByUserIdAndPerfumeId(Long userId, Long perfumeId);

    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * 내가 이 향수에 쓴 후기 번호입니다. 쓰지 않았으면 빈 {@link Optional} 입니다.
     *
     * <p>향수 상세가 [후기 쓰기] 와 [후기 수정] 중 무엇을 띄울지 정하는 데 씁니다. 한 사람은 한
     * 향수에 후기를 하나만 가질 수 있어 결과도 하나뿐입니다.
     *
     * <p>V5 의 {@code uk_perfume_reviews_user_perfume} 이 정확히 이 두 컬럼이라, 색인에서 한 행을
     * 바로 찾고 끝납니다.
     */
    @Query("""
            SELECT r.id
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
              AND r.userId = :userId
            """)
    Optional<Long> findIdByPerfumeIdAndUserId(
            @Param("perfumeId") Long perfumeId,
            @Param("userId") Long userId
    );

    /**
     * 후기 게시판 한 줄에 실을 값입니다.
     *
     * <p>향수와 브랜드를 함께 읽습니다. 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다 어느
     * 향수 이야기인지 보여야 합니다. 후기마다 향수를 따로 조회하면 한 페이지에 쿼리가 스무 번
     * 나갑니다.
     *
     * <p>왼쪽 조인인 이유가 셋입니다. 작성자는 탈퇴하면 비고, 브랜드가 없는 향수가 있으며,
     * {@code perfume_id} 자체도 비어 있을 수 있는 컬럼입니다. 안쪽 조인으로 두면 그런 후기가
     * 게시판에서 통째로 사라집니다.
     *
     * <p>좋아요 수는 딸린 쿼리로 셉니다. {@code review_likes} 의 기본키가 후기 번호로 시작해 표를
     * 보지 않고 셀 수 있습니다. 조회수만 저장된 값을 그대로 읽습니다.
     */
    String BOARD_SELECT = """
            SELECT r.id AS reviewId,
                   r.title AS title,
                   r.content AS content,
                   u.nickname AS nickname,
                   p.perfume_id AS perfumeId,
                   p.name AS perfumeName,
                   b.name AS brand,
                   r.view_count AS viewCount,
                   (SELECT COUNT(*)
                      FROM review_likes rl
                     WHERE rl.review_id = r.id) AS likeCount,
                   r.created_at AS createdAt,
                   COALESCE(r.updated_at, r.created_at) AS updatedAt
            FROM perfume_reviews r
            LEFT JOIN users u ON u.user_id = r.user_id
            LEFT JOIN perfumes p ON p.perfume_id = r.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            """;

    /**
     * 최신순입니다. 시각이 같거나 비어 있어도 {@code id} 로 순서를 확정합니다. 순서가 흔들리면
     * 페이지를 넘길 때 같은 후기가 두 번 나오거나 어떤 후기가 아예 빠집니다.
     */
    String BOARD_ORDER_RECENT = "ORDER BY r.created_at DESC NULLS LAST, r.id DESC";

    /** 조회가 많은 순입니다. 저장된 값이라 V13 의 {@code idx_perfume_reviews_views} 를 씁니다. */
    String BOARD_ORDER_VIEWS =
            "ORDER BY r.view_count DESC, r.created_at DESC NULLS LAST, r.id DESC";

    /**
     * 좋아요가 많은 순입니다. 세어 봐야 나오는 값이라 인덱스로 받지 못합니다.
     *
     * <p>{@code likeCount} 는 위에서 붙인 별칭입니다. 같은 딸린 쿼리를 두 번 쓰지 않습니다.
     */
    String BOARD_ORDER_LIKES =
            "ORDER BY likeCount DESC, r.created_at DESC NULLS LAST, r.id DESC";

    String BOARD_COUNT = "SELECT COUNT(*) FROM perfume_reviews";

    @Query(value = BOARD_SELECT + BOARD_ORDER_RECENT, countQuery = BOARD_COUNT,
            nativeQuery = true)
    Page<ReviewBoardRow> findBoardPageByRecent(Pageable pageable);

    @Query(value = BOARD_SELECT + BOARD_ORDER_VIEWS, countQuery = BOARD_COUNT, nativeQuery = true)
    Page<ReviewBoardRow> findBoardPageByViews(Pageable pageable);

    @Query(value = BOARD_SELECT + BOARD_ORDER_LIKES, countQuery = BOARD_COUNT, nativeQuery = true)
    Page<ReviewBoardRow> findBoardPageByLikes(Pageable pageable);

    /** 후기 게시판의 단건입니다. 목록과 같은 값을 씁니다. */
    @Query(value = BOARD_SELECT + "WHERE r.id = :reviewId", nativeQuery = true)
    Optional<ReviewBoardRow> findBoardRow(@Param("reviewId") Long reviewId);

    /**
     * 조회수를 하나 올립니다.
     *
     * <p>읽어서 더하고 저장하지 않고 <b>표에게 더하라고 시킵니다.</b> 두 사람이 동시에 열면 둘 다
     * 같은 값을 읽어 같은 값을 쓰게 되어 한 번이 사라집니다. 이 문장은 그런 틈이 없습니다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PerfumeReview r SET r.viewCount = r.viewCount + 1 WHERE r.id = :reviewId")
    int increaseViewCount(@Param("reviewId") Long reviewId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM PerfumeReview r
            WHERE r.id = :reviewId
              AND r.userId = :userId
            """)
    Optional<PerfumeReview> findByIdAndUserIdForUpdate(
            @Param("reviewId") Long reviewId,
            @Param("userId") Long userId
    );

    @Query(
            value = """
                    SELECT r.id AS reviewId,
                           u.nickname AS nickname,
                           r.title AS title,
                           r.content AS content,
                           CASE WHEN r.user_id = :currentUserId THEN TRUE ELSE FALSE END AS mine,
                           r.created_at AS createdAt,
                           COALESCE(r.updated_at, r.created_at) AS updatedAt
                    FROM perfume_reviews r
                    LEFT JOIN users u ON u.user_id = r.user_id
                    WHERE r.perfume_id = :perfumeId
                    ORDER BY r.created_at DESC NULLS LAST, r.id DESC
                    """,
            countQuery = "SELECT COUNT(*) FROM perfume_reviews WHERE perfume_id = :perfumeId",
            nativeQuery = true
    )
    Page<PerfumeReviewListRow> findPageByPerfumeId(
            @Param("perfumeId") Long perfumeId,
            @Param("currentUserId") Long currentUserId,
            Pageable pageable
    );

    /**
     * 향수의 후기 수입니다.
     *
     * <p>키워드 추출을 시작하는 최소 개수 정책의 기준이라, 배치가 대상을 고를 때 세는 수와
     * 같아야 합니다. 지금은 양쪽 다 향수에 달린 모든 후기입니다.
     *
     * <p>메모({@code memos})는 세지 않습니다. 기능 명세서의 시스템 처리 항목에
     * 메모를 함께 분석한다는 문장이 있으나, 팀이 후기만 쓰기로 정했습니다.
     */
    @Query("""
            SELECT COUNT(r)
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
            """)
    long countByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 계절을 하나라도 고른 후기 수입니다. 계절 백분율의 분모로 씁니다.
     *
     * <p>계절을 고르지 않은 후기까지 분모에 넣으면, 계절을 답한 사람들의 분포가 희석됩니다.
     *
     * <p>기능 명세서는 비율을 사용자 기준으로 정의합니다. 여기서 후기를 세는데도 같은 값이
     * 나오는 것은 review 도메인이 한 사용자가 한 향수에 후기를 하나만 갖도록 보장하기
     * 때문입니다. 이 전제가 깨지면 후기를 여러 개 쓴 사용자가 여러 표를 던지게 되므로,
     * {@code perfume_reviews} 에 {@code (user_id, perfume_id)} 유니크 제약이 필요합니다.
     */
    @Query("""
            SELECT COUNT(DISTINCT rs.id.reviewId)
            FROM PerfumeReviewSeason rs, PerfumeReview r
            WHERE rs.id.reviewId = r.id
              AND r.perfume.id = :perfumeId
            """)
    long countReviewsWithSeasonByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 계절별 후기 수입니다. 후기가 고르지 않은 계절도 0 으로 포함합니다.
     *
     * <p>화면이 계절 네 칸을 항상 그리므로, 데이터가 있는 계절만 주면 빈 칸을 화면이 채워야 합니다.
     * 그래서 {@code Season} 을 기준으로 왼쪽 조인합니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.SeasonCount(
                       s.id, s.code, s.name, COUNT(r.id))
            FROM Season s
            LEFT JOIN PerfumeReviewSeason rs ON rs.id.seasonId = s.id
            LEFT JOIN PerfumeReview r ON r.id = rs.id.reviewId AND r.perfume.id = :perfumeId
            GROUP BY s.id, s.code, s.name
            ORDER BY s.id
            """)
    List<SeasonCount> findSeasonCountsByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 후기 요약을 새로 만들어야 하는 향수를 찾습니다.
     *
     * <p>조건은 두 가지입니다. 요약할 수 있는 후기가 {@code minReviewCount} 개 이상이어야 하고,
     * 요약이 아직 없거나 요약을 만든 뒤로 후기가 {@code regenerationStep} 개 이상 늘어나 있어야
     * 합니다. 요구사항 정의서 DTL-23 의 "일정 개수 이상의 후기가 존재하는 경우 요약을 제공한다"가
     * 앞 조건이고, 뒤 조건은 매번 전체 향수를 다시 요약하지 않기 위한 것입니다.
     *
     * <p>앞 조건은 본문이 있는 후기만 셉니다. 후기 작성 API 와 스키마가 본문을 필수로 막지 않아
     * 공백만 있는 후기가 들어올 수 있습니다. 그런 후기까지 세면 본문이 스무 건 비어 있는 향수가
     * 대상이 되어 {@link #findContentsByPerfumeId} 가 빈 목록을 돌려주고, 요약을 만들지 못해
     * {@code source_review_count} 도 오르지 않습니다. 그러면 그 향수는 매 실행마다 다시 대상이
     * 되어 한 실행의 처리 상한을 계속 차지합니다. 본문이 제대로 있는 향수가 그만큼 밀립니다.
     *
     * <p>반면 뒤 조건과 {@link ReviewSummaryTarget#reviewCount()} 는 전체 후기 수입니다. 이
     * 값이 {@code source_review_count} 로 저장되고 후기 통계 API 의 {@code reviewCount} 와
     * 비교되므로, 양쪽이 같은 것을 세야 합니다.
     *
     * <p>비활성 향수는 제외합니다. 조회 API 가 비활성 향수에 404 를 주므로 요약을 만들어도
     * 보이지 않고, AI 호출 비용만 나갑니다.
     *
     * <p>후기가 하나도 없는 향수는 {@code PerfumeReview} 를 기준으로 시작하는 것만으로 빠집니다.
     * 어차피 {@code minReviewCount} 조건에 걸립니다.
     *
     * <p>요약할 수 있는 후기가 많은 향수부터 처리합니다. 한 번에 처리할 향수 수를
     * {@code Pageable} 로 제한하는데, 정렬이 없으면 어떤 향수가 잘려 나갈지 데이터베이스가
     * 정합니다. 처리한 향수는 {@code source_review_count} 가 올라가 다음 실행의 대상에서
     * 빠지므로, 뒤로 밀린 향수도 다음 실행에서 차례가 옵니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewSummaryTarget(
                       p.id, COUNT(r.id))
            FROM PerfumeReview r
            JOIN r.perfume p
            LEFT JOIN PerfumeReviewSummary s ON s.perfumeId = p.id
            WHERE p.active = true
            GROUP BY p.id, s.sourceReviewCount
            HAVING SUM(CASE WHEN r.content IS NOT NULL AND LENGTH(TRIM(r.content)) > 0
                            THEN 1 ELSE 0 END) >= :minReviewCount
               AND (s.sourceReviewCount IS NULL
                    OR COUNT(r.id) - s.sourceReviewCount >= :regenerationStep)
            ORDER BY SUM(CASE WHEN r.content IS NOT NULL AND LENGTH(TRIM(r.content)) > 0
                              THEN 1 ELSE 0 END) DESC, p.id
            """)
    List<ReviewSummaryTarget> findSummaryTargets(
            @Param("minReviewCount") int minReviewCount,
            @Param("regenerationStep") int regenerationStep,
            Pageable pageable
    );

    /**
     * AI 에게 보낼 후기 원문을 최근 작성 순으로 가져옵니다.
     *
     * <p>본문이 비어 있는 후기는 뺍니다. 요약에 아무것도 보태지 못하면서 토큰만 먹습니다.
     * {@link #findSummaryTargets} 가 대상을 고를 때 세는 후기도 같은 기준입니다. 두 기준이
     * 어긋나면 보낼 것이 없는 향수가 대상으로 잡힙니다.
     *
     * <p>그렇다고 {@link #countByPerfumeId} 의 기준을 바꾸지는 않습니다. 요약이 최신인지
     * 판단하는 기준은 "향수에 달린 후기 수"여야 하고, 본문이 빈 후기도 그 수에는 들어갑니다.
     *
     * <p>{@code created_at} 이 비어 있을 수 있어 {@code NULLS LAST} 와 후기 번호를 함께
     * 씁니다. 정렬이 흔들리면 개수 제한에 걸려 잘리는 후기가 실행마다 달라집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.ReviewContent(
                       r.id, r.title, r.content)
            FROM PerfumeReview r
            WHERE r.perfume.id = :perfumeId
              AND r.content IS NOT NULL
              AND LENGTH(TRIM(r.content)) > 0
            ORDER BY r.createdAt DESC NULLS LAST, r.id DESC
            """)
    List<ReviewContent> findContentsByPerfumeId(
            @Param("perfumeId") Long perfumeId,
            Pageable pageable
    );
}
