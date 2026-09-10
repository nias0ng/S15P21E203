package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.ReviewKeyword;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 후기 키워드 어휘입니다. 후기 요약·키워드 배치가 씁니다.
 *
 * <p>이름으로 찾아 없으면 만드는 식으로 쓰기 때문에 이름 조회가 필요합니다. 통계 조회는
 * {@link PerfumeReviewKeywordRepository} 가 후기와 이어진 행을 세는 것으로 끝나므로 이
 * 인터페이스를 쓰지 않습니다.
 */
public interface ReviewKeywordRepository extends JpaRepository<ReviewKeyword, Long> {

    /**
     * 이름이 이미 어휘에 있는 키워드를 가져옵니다.
     *
     * <p>이름 하나씩 조회하지 않는 이유는 후기 하나에서 키워드가 여러 개 나오고 후기도 여러
     * 건이라, 한 향수를 처리할 때마다 수십 번의 쿼리가 나가기 때문입니다.
     */
    List<ReviewKeyword> findByNameIn(Collection<String> names);
}
