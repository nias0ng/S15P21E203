package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.entity.Perfume;
import java.util.Collection;
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
     * 목록 쿼리와 카운트 쿼리가 같은 조건을 보도록 묶어 둡니다. 한쪽만 고치면 마지막 페이지가
     * 비거나 전체 개수가 맞지 않습니다.
     *
     * <p>세 조건 모두 {@code null} 이면 건너뜁니다. {@code CAST} 가 필요한 이유가 있습니다.
     * {@code :keyword IS NULL} 처럼 파라미터를 맨몸으로 쓰면 PostgreSQL 이 타입을 추론하지 못해
     * {@code bytea} 로 바인딩하고, 그 값이 {@code LOWER()} 로 들어가면
     * {@code function lower(bytea) does not exist} 로 실패합니다. 더 나쁜 것은 이 실패가 실행
     * 순서를 탄다는 점입니다. 같은 커넥션에서 앞선 쿼리가 문자열을 바인딩해 두면 통과하고, 단독으로
     * 실행하면 실패합니다. {@code CAST} 로 타입을 못박아 두면 순서와 무관하게 동작합니다.
     *
     * <p>{@code IS NULL} 자리에만 {@code CAST} 를 걸면 부족합니다. 같은 이름의 파라미터라도 쿼리에
     * 나타나는 위치마다 따로 바인딩되고, {@code CONCAT} 은 인자 타입을 가리지 않아 추론에 도움이
     * 되지 않습니다. 그래서 모든 사용 위치에 {@code CAST} 를 겁니다.
     */
    String SEARCH_CONDITION = """
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (CAST(:keyword AS String) IS NULL
                OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) ESCAPE '!'
                OR LOWER(p.nameKo) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) ESCAPE '!'
                OR LOWER(b.name) LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) ESCAPE '!')
              AND (CAST(:brand AS String) IS NULL OR b.name = CAST(:brand AS String))
              AND (CAST(:gender AS String) IS NULL OR p.gender = CAST(:gender AS String))
            """;

    /** 진열대 필터가 검색 조건 뒤에 덧붙이는 절입니다. */
    String IN_PERFUME_IDS = """
              AND p.id IN :perfumeIds
            """;

    /**
     * 검색 조건에 맞는 활성 향수를 조회합니다. 조건이 여럿이면 AND 로 걸립니다.
     *
     * <p>{@code brand_id} 가 nullable 이므로 {@code LEFT JOIN} 입니다. {@code INNER JOIN} 을 쓰면
     * 브랜드가 없는 향수가 검색 결과에서 조용히 사라집니다. 반대로 {@code brand} 필터가 걸리면
     * 브랜드가 없는 향수는 자연히 빠집니다.
     *
     * <p>{@code keyword} 는 LIKE 와일드카드가 이스케이프된 상태여야 합니다.
     * {@link PerfumeService} 가 처리합니다. 이스케이프하지 않으면 사용자가 입력한 {@code %} 나
     * {@code _} 가 와일드카드로 동작해 활성 향수 전체가 조회됩니다.
     *
     * <p>이스케이프 문자로 관례적인 백슬래시 대신 {@code !} 를 쓴 이유가 있습니다. 자바 텍스트 블록에서
     * 백슬래시는 이스케이프 문자라 소스에 두 개를 써야 쿼리에 하나가 들어가는데, 나중에 하나로 줄이면
     * {@code ESCAPE ''} 가 되어 이스케이프가 조용히 사라집니다.
     *
     * <p>{@code brand} 는 완전 일치입니다. 브랜드명 부분 일치는 {@code keyword} 가 담당합니다.
     */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse(p.id, p.name, p.nameKo, b.name)
            """ + SEARCH_CONDITION,
            countQuery = "SELECT COUNT(p) " + SEARCH_CONDITION)
    Page<PerfumeSummaryResponse> search(
            @Param("keyword") String keyword,
            @Param("brand") String brand,
            @Param("gender") String gender,
            Pageable pageable);

    /**
     * 같은 조건에 향수 번호 목록까지 더해 조회합니다. 진열대 필터가 씁니다.
     *
     * <p>번호 목록은 {@link PerfumeShelfRepository} 가 사용자 기준으로 뽑아 옵니다.
     *
     * <p>{@link #search} 에 조건을 합치지 않고 메서드를 나눈 이유가 있습니다. 진열대 필터가 없는
     * 요청에는 넘길 번호가 없는데, 컬렉션 파라미터는 {@code null} 로 두고 {@code IS NULL} 로
     * 건너뛸 수 없습니다. 합치려면 필터가 없을 때 "아무것도 거르지 않는 가짜 목록"을 만들어야
     * 하고, 그런 값은 언젠가 진짜 향수 번호와 겹칩니다.
     *
     * <p>빈 목록을 넘겨도 Hibernate 가 항상 거짓인 조건으로 바꿔 주므로 오류는 나지 않습니다.
     * 다만 서비스가 그 전에 끊어 질의 두 번을 아낍니다.
     */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse(p.id, p.name, p.nameKo, b.name)
            """ + SEARCH_CONDITION + IN_PERFUME_IDS,
            countQuery = "SELECT COUNT(p) " + SEARCH_CONDITION + IN_PERFUME_IDS)
    Page<PerfumeSummaryResponse> searchWithinPerfumeIds(
            @Param("keyword") String keyword,
            @Param("brand") String brand,
            @Param("gender") String gender,
            @Param("perfumeIds") Collection<Long> perfumeIds,
            Pageable pageable);

    /**
     * 향수 기본 정보를 조회합니다. 향조·후기·통계는 명세상 별도 기능이라 포함하지 않습니다.
     *
     * <p>비활성 향수는 조회되지 않습니다. 검색에서 제외하는 것과 같은 기준입니다.
     *
     * <p>{@code brand_id} 가 nullable 이므로 {@code LEFT JOIN} 입니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse(
                       p.id, b.id, b.name, p.name, p.nameKo, p.gender, p.description, p.concentration)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.id = :perfumeId
              AND p.active = true
            """)
    Optional<PerfumeDetailResponse> findDetailById(@Param("perfumeId") Long perfumeId);
}
