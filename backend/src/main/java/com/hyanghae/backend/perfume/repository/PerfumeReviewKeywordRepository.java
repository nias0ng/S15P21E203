package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReviewKeyword;
import com.hyanghae.backend.perfume.entity.PerfumeReviewKeywordId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 후기 키워드 통계 조회입니다.
 *
 * <p>계절 통계와 같은 구조지만 한 가지가 다릅니다. 계절은 네 개로 고정이라 후기가 없는 계절도
 * 0 으로 채워 내려주지만, 키워드는 어휘가 열려 있어 나온 것만 돌려줍니다.
 */
public interface PerfumeReviewKeywordRepository
        extends JpaRepository<PerfumeReviewKeyword, PerfumeReviewKeywordId> {

    /**
     * 키워드가 하나라도 뽑힌 후기 수입니다. 백분율의 분모로 씁니다.
     *
     * <p>연관관계를 매핑하지 않아 {@code JOIN ... ON} 으로 조인 조건을 직접 씁니다. 조인 조건을
     * {@code WHERE} 에 섞어 쓰면 어디까지가 조인이고 어디부터가 걸러내는 조건인지 구분되지
     * 않습니다.
     *
     * <p>후기 하나에서 키워드가 여러 개 나오므로 {@code DISTINCT} 가 필요합니다. 빼면 분모가
     * 키워드 개수만큼 부풀어 모든 백분율이 작아집니다.
     *
     * <p>키워드가 하나도 뽑히지 않은 후기는 분모에서 빠집니다. 분석되지 않은 후기까지 넣으면
     * 표현을 남긴 사람들의 분포가 희석됩니다. 계절 통계와 같은 기준입니다.
     */
    @Query("""
            SELECT COUNT(DISTINCT rk.id.reviewId)
            FROM PerfumeReviewKeyword rk
            JOIN PerfumeReview r ON r.id = rk.id.reviewId
            WHERE r.perfume.id = :perfumeId
            """)
    long countReviewsWithKeywordByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 키워드별로 그 키워드가 나온 후기 수입니다. 많이 나온 순으로 정렬하고, 같으면 키워드 이름으로
     * 순서를 확정합니다. 순서가 흔들리면 화면이 앞에서 몇 개만 잘라 쓸 때 결과가 매번 달라집니다.
     *
     * <p>{@code DISTINCT} 를 쓰지 않는 이유는 기본키가 {@code (review_id, keyword_id)} 라
     * 같은 후기에 같은 키워드가 두 번 붙을 수 없기 때문입니다.
     *
     * <p>개수 제한을 {@code Pageable} 로 받아 데이터베이스에서 자릅니다. 화면이 상위 몇 개만
     * 쓰는데 향수마다 키워드가 수십 개씩 나올 수 있어, 다 받아서 버리면 그만큼이 전송 낭비입니다.
     * 자르는 것은 표시 개수뿐입니다. 백분율의 분모는 따로 세므로 몇 개를 받든 각 키워드의 값은
     * 같습니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.KeywordCount(k.name, COUNT(rk))
            FROM PerfumeReviewKeyword rk
            JOIN ReviewKeyword k ON k.id = rk.id.keywordId
            JOIN PerfumeReview r ON r.id = rk.id.reviewId
            WHERE r.perfume.id = :perfumeId
            GROUP BY k.id, k.name
            ORDER BY COUNT(rk) DESC, k.name
            """)
    List<KeywordCount> findKeywordCountsByPerfumeId(
            @Param("perfumeId") Long perfumeId,
            Pageable pageable
    );

    /**
     * 후기에 붙어 있던 키워드를 모두 떼어냅니다. 배치가 그 후기의 키워드를 이번 결과로 정할 때 씁니다.
     *
     * <p>지우지 않고 새 키워드만 더하면, 같은 후기를 두 번 분석했을 때 두 결과가 합쳐집니다.
     * AI 응답은 실행마다 조금씩 달라지므로 키워드가 계속 늘어나고, 키워드별 비중이 실제보다
     * 커집니다. 지우고 다시 넣으면 같은 후기를 몇 번 분석해도 결과가 마지막 분석 하나입니다.
     *
     * <p>{@code review_keywords} 의 어휘는 지우지 않습니다. 다른 후기가 같은 이름을 쓰고 있고,
     * 아무도 쓰지 않는 이름이 남아도 통계는 후기와 이어진 행만 셉니다.
     */
    @Modifying
    @Query("""
            DELETE FROM PerfumeReviewKeyword rk
            WHERE rk.id.reviewId IN :reviewIds
            """)
    void deleteByReviewIdIn(@Param("reviewIds") Collection<Long> reviewIds);
}
