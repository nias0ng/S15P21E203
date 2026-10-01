package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.entity.PostPerfume;
import com.hyanghae.backend.community.entity.PostPerfumeId;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 최근 글에 많이 언급된 향수를 셉니다.
 *
 * <p>글에 걸린 향수를 읽는 일이 이미 {@code PostPerfumeRow} 쪽에 있지만, 그쪽은 <b>어떤 글에
 * 무엇이 걸렸는지</b>를 보고 여기는 <b>기간 안에 몇 번 걸렸는지</b>를 봅니다. 읽는 대상이 같을
 * 뿐 묻는 것이 달라 따로 둡니다.
 */
public interface TrendingPerfumeRepository extends JpaRepository<PostPerfume, PostPerfumeId> {

    /**
     * 기간 안에 쓰인 글에 걸린 향수를 많이 걸린 순으로 셉니다.
     *
     * <p><b>활성 향수만 셉니다.</b> 내려간 향수가 순위에 오르면 눌렀을 때 404 가 납니다.
     *
     * <p>{@code created_at} 이 비어 있는 글은 빠집니다. 기간을 물었는데 시각을 모르는 글을
     * 넣을 수는 없습니다.
     *
     * <p>같은 수가 흔하므로 향수 번호까지 이어 붙여 순서를 확정합니다. 순서가 흔들리면 새로
     * 고칠 때마다 목록이 뒤바뀝니다.
     */
    @Query(value = """
            SELECT p.perfume_id AS perfumeId,
                   p.name AS name,
                   p.name_ko AS nameKo,
                   b.name AS brand,
                   b.name_ko AS brandKo,
                   COUNT(*) AS mentionCount
            FROM post_perfumes pp
            JOIN posts po ON po.post_id = pp.post_id
            JOIN perfumes p ON p.perfume_id = pp.perfume_id
            LEFT JOIN brands b ON b.brand_id = p.brand_id
            WHERE po.created_at >= :since
              AND p.is_active = TRUE
            GROUP BY p.perfume_id, p.name, p.name_ko, b.name, b.name_ko
            ORDER BY COUNT(*) DESC, p.perfume_id
            LIMIT :limit
            """, nativeQuery = true)
    List<TrendingPerfumeRow> findTrending(
            @Param("since") OffsetDateTime since,
            @Param("limit") int limit
    );
}
