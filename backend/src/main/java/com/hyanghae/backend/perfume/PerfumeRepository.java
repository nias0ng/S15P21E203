package com.hyanghae.backend.perfume;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 향수 조회 쿼리입니다.
 *
 * <p>엔티티가 아니라 DTO 를 바로 조회합니다. {@code Page<Perfume>} 로 받아 서비스에서
 * {@code getBrand().getName()} 을 호출하면 향수 건수만큼 추가 쿼리가 나가고(N+1),
 * {@code open-in-view} 가 {@code false} 라 트랜잭션 밖에서는 지연 로딩 자체가 실패합니다.
 * DTO 프로젝션은 목록·카운트 두 번의 쿼리로 끝납니다.
 *
 * <p>{@code brand_id} 가 nullable 이므로 {@code LEFT JOIN} 입니다. {@code INNER JOIN} 을 쓰면
 * 브랜드가 없는 향수가 검색 결과에서 조용히 사라집니다.
 *
 * <p>검색어 유무를 하나의 쿼리에서 {@code :keyword IS NULL} 로 분기하지 않고 메서드를 둘로 나눈
 * 이유가 있습니다. null 을 바인딩하면 PostgreSQL 이 {@code '%' || ? || '%'} 의 파라미터 타입을
 * {@code bytea} 로 추론해 {@code lower(bytea) does not exist} 로 실패합니다. 검색어가 있는 요청이
 * 먼저 실행되면 준비된 구문의 타입이 고정되어 한동안 드러나지 않는, 순서에 의존하는 실패였습니다.
 */
public interface PerfumeRepository extends JpaRepository<Perfume, Long> {

    /** 검색어가 없을 때 활성 향수 전체를 조회합니다. */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.PerfumeSummaryResponse(p.id, p.name, b.name)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
            """,
            countQuery = """
            SELECT COUNT(p)
            FROM Perfume p
            WHERE p.active = true
            """)
    Page<PerfumeSummaryResponse> findAllActive(Pageable pageable);

    /** 향수명(영문·한글)과 브랜드명에 검색어가 포함된 활성 향수를 조회합니다. */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.PerfumeSummaryResponse(p.id, p.name, b.name)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(p.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """,
            countQuery = """
            SELECT COUNT(p)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(p.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
            """)
    Page<PerfumeSummaryResponse> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
}
