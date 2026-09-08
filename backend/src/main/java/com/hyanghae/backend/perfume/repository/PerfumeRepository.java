package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.entity.Perfume;
import java.util.Optional;
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
 */
public interface PerfumeRepository extends JpaRepository<Perfume, Long> {

    /** LIKE 패턴의 이스케이프 문자입니다. {@link PerfumeService} 가 같은 값을 씁니다. */
    String LIKE_ESCAPE = "!";

    /**
     * 향수명(영문·한글)과 브랜드명에 검색어가 부분 일치하는 활성 향수를 조회합니다.
     *
     * <p>{@code brand_id} 가 nullable 이므로 {@code LEFT JOIN} 입니다. {@code INNER JOIN} 을 쓰면
     * 브랜드가 없는 향수가 검색 결과에서 조용히 사라집니다.
     *
     * <p>{@code keyword} 는 {@code null} 이 될 수 없고 LIKE 와일드카드가 이스케이프된 상태여야 합니다.
     * {@link PerfumeService} 가 둘 다 처리합니다. null 을 바인딩하면 PostgreSQL 이 파라미터 타입을
     * {@code bytea} 로 추론해 실패하고, 이스케이프하지 않으면 사용자가 입력한 {@code %} 나 {@code _}
     * 가 와일드카드로 동작해 활성 향수 전체가 조회됩니다.
     *
     * <p>이스케이프 문자로 관례적인 백슬래시 대신 {@code !} 를 쓴 이유가 있습니다. 자바 텍스트 블록에서
     * 백슬래시는 이스케이프 문자라 소스에 두 개를 써야 쿼리에 하나가 들어가는데, 나중에 하나로 줄이면
     * {@code ESCAPE ''} 가 되어 이스케이프가 조용히 사라집니다.
     */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse(p.id, p.name, p.nameKo, b.name)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!'
                OR LOWER(p.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!'
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!')
            """,
            countQuery = """
            SELECT COUNT(p)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!'
                OR LOWER(p.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!'
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '!')
            """)
    Page<PerfumeSummaryResponse> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    /**
     * 향수 기본 정보를 조회합니다. 향조·후기·통계는 명세상 별도 기능이라 포함하지 않습니다.
     *
     * <p>비활성 향수는 조회되지 않습니다. 검색에서 제외하는 것과 같은 기준입니다.
     *
     * <p>{ brand_id} 가 nullable 이므로 { LEFT JOIN} 입니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse(p.id, p.name, b.name, p.description)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.id = :perfumeId
              AND p.active = true
            """)
    Optional<PerfumeDetailResponse> findDetailById(@Param("perfumeId") Long perfumeId);
}
