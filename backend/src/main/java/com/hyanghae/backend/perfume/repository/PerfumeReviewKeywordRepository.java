package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.PerfumeReviewKeyword;
import com.hyanghae.backend.perfume.entity.PerfumeReviewKeywordId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * <p>후기 하나에서 키워드가 여러 개 나오므로 {@code DISTINCT} 가 필요합니다. 빼면 분모가
     * 키워드 개수만큼 부풀어 모든 백분율이 작아집니다.
     *
     * <p>키워드가 하나도 뽑히지 않은 후기는 분모에서 빠집니다. 분석되지 않은 후기까지 넣으면
     * 표현을 남긴 사람들의 분포가 희석됩니다. 계절 통계와 같은 기준입니다.
     */
    @Query("""
            SELECT COUNT(DISTINCT rk.id.reviewId)
            FROM PerfumeReviewKeyword rk, PerfumeReview r
            WHERE rk.id.reviewId = r.id
              AND r.perfume.id = :perfumeId
            """)
    long countReviewsWithKeywordByPerfumeId(@Param("perfumeId") Long perfumeId);

    /**
     * 키워드별로 그 키워드가 나온 후기 수입니다. 많이 나온 순으로 정렬하고, 같으면 키워드 이름으로
     * 순서를 확정합니다. 순서가 흔들리면 화면이 앞에서 몇 개만 잘라 쓸 때 결과가 매번 달라집니다.
     *
     * <p>{@code DISTINCT} 를 쓰지 않는 이유는 기본키가 {@code (review_id, keyword_id)} 라
     * 같은 후기에 같은 키워드가 두 번 붙을 수 없기 때문입니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.KeywordCount(k.name, COUNT(rk))
            FROM PerfumeReviewKeyword rk, ReviewKeyword k, PerfumeReview r
            WHERE rk.id.keywordId = k.id
              AND rk.id.reviewId = r.id
              AND r.perfume.id = :perfumeId
            GROUP BY k.id, k.name
            ORDER BY COUNT(rk) DESC, k.name
            """)
    List<KeywordCount> findKeywordCountsByPerfumeId(@Param("perfumeId") Long perfumeId);
}
