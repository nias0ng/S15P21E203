package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.entity.Perfume;
import java.util.Collection;
import java.util.List;
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

    /** 활성 향수만 찾습니다. 보낸 수와 결과 수가 다르면 없거나 내려간 향수가 섞인 것입니다. */
    List<Perfume> findAllByIdInAndActiveTrue(Collection<Long> perfumeIds);

    /** LIKE 패턴의 이스케이프 문자입니다. {@link PerfumeService} 가 같은 값을 씁니다. */
    String LIKE_ESCAPE = "!";

    /**
     * 검색어를 견주는 한 줄입니다 — 한국어 브랜드 · 이름, 공백 하나, 영문 브랜드 · 이름을 공백을
     * 지워 잇습니다. 왜 잇는지는 {@link #SEARCH_CONDITION} 에 적었습니다.
     */
    String NAMES = "LOWER(CONCAT("
            + "REPLACE(COALESCE(b.nameKo, ''), ' ', ''), REPLACE(COALESCE(p.nameKo, ''), ' ', ''), ' ', "
            + "REPLACE(COALESCE(b.name, ''), ' ', ''), REPLACE(COALESCE(p.name, ''), ' ', '')))";

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
     *
     * <p><b>이름에서 공백을 지우고 견줍니다.</b> 이름을 어디서 띄는지는 사람마다 다른데 저장된
     * 이름은 한 가지입니다('빅토리아 시크릿'). 검색어 쪽도 {@code PerfumeService.normalize} 가
     * 같이 지웁니다 — 한쪽만 지우면 반대 방향, 즉 띄어 친 검색어가 도로 안 걸립니다.
     *
     * <p>{@code REPLACE} 는 HQL 함수라 JPQL 에서 그대로 쓸 수 있고, PostgreSQL 에도 같은 이름의
     * 함수가 있어 {@code PerfumeRankingRepository.CONDITION} 의 SQL 판과 글자까지 같습니다. 두
     * 경로가 같은 답을 내는지는 통합 테스트가 봅니다.
     *
     * <p><b>네 칸을 한 줄로 이어 붙여 견줍니다</b>({@link #NAMES}). 한 칸씩 견주면
     * '딥티크 오르페옹' 처럼 브랜드와 이름을 같이 친 검색어가 어느 칸에도 통째로 없어 0건이
     * 됐습니다(지인 피드백 F2). 이은 줄은 {@code 한국어 브랜드 + 한국어 이름 + ' ' + 영문 브랜드 +
     * 영문 이름} 입니다. 검색어는 공백을 지운 채 오므로 가운데 둔 공백을 넘어서 걸리는 일이
     * 없고, 한 칸에 걸리던 검색어는 이은 줄에도 그대로 걸립니다.
     *
     * <p><b>통째로 안 걸리면 낱말마다 봅니다</b>({@code :t1} ~ {@code :t4}). 낱말이 모두 이은 줄
     * 어딘가에 있으면 걸립니다. 낱말을 고르는 일(찾는 말투 · 끝 조사 떼기)은
     * {@code PerfumeService.searchWords} 가 합니다. 낱말이 하나뿐이고 검색어와 같으면 넘기지
     * 않습니다 — 통째 견주기와 같은 일을 두 번 하게 됩니다.
     *
     * <p>텍스트 블록을 끊어 이은 까닭은 {@link #NAMES} 를 다섯 번 넣어야 해서입니다.
     * {@code @Query} 에 들어가는 값이라 {@code formatted()} 를 못 쓰고 상수끼리 {@code +} 로만
     * 이을 수 있습니다.
     */
    String SEARCH_CONDITION = """
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.active = true
              AND (CAST(:keyword AS String) IS NULL
            """
            + " OR " + NAMES + " LIKE LOWER(CONCAT('%', CAST(:keyword AS String), '%')) ESCAPE '!'"
            + " OR (CAST(:t1 AS String) IS NOT NULL"
            + " AND " + NAMES + " LIKE LOWER(CONCAT('%', CAST(:t1 AS String), '%')) ESCAPE '!'"
            + " AND (CAST(:t2 AS String) IS NULL"
            + " OR " + NAMES + " LIKE LOWER(CONCAT('%', CAST(:t2 AS String), '%')) ESCAPE '!')"
            + " AND (CAST(:t3 AS String) IS NULL"
            + " OR " + NAMES + " LIKE LOWER(CONCAT('%', CAST(:t3 AS String), '%')) ESCAPE '!')"
            + " AND (CAST(:t4 AS String) IS NULL"
            + " OR " + NAMES + " LIKE LOWER(CONCAT('%', CAST(:t4 AS String), '%')) ESCAPE '!')))"
            + """

              AND (CAST(:brand AS String) IS NULL OR b.name = CAST(:brand AS String))
              AND (:brandId IS NULL OR b.id = :brandId)
              AND (CAST(:gender AS String) IS NULL OR p.gender = CAST(:gender AS String))
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
     * <p>{@code brand} 는 완전 일치입니다. 브랜드명 부분 일치는 {@code keyword} 가 담당하며,
     * 영문 이름과 한국어 이름을 모두 봅니다. 한쪽만 보면 한국어로 브랜드를 친 검색이 0건이 됩니다.
     */
    @Query(value = """
            SELECT new com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse(
                       p.id, p.name, p.nameKo, b.name, b.nameKo)
            """ + SEARCH_CONDITION,
            countQuery = "SELECT COUNT(p) " + SEARCH_CONDITION)
    Page<PerfumeSummaryResponse> search(
            @Param("keyword") String keyword,
            @Param("t1") String t1,
            @Param("t2") String t2,
            @Param("t3") String t3,
            @Param("t4") String t4,
            @Param("brand") String brand,
            @Param("brandId") Long brandId,
            @Param("gender") String gender,
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
                       p.id, b.id, b.name, b.nameKo, p.name, p.nameKo, p.gender,
                       p.description, p.concentration)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.id = :perfumeId
              AND p.active = true
            """)
    Optional<PerfumeDetailResponse> findDetailById(@Param("perfumeId") Long perfumeId);

    /**
     * 조회 가능한 향수인지 확인합니다. 향조·통계처럼 향수 자체는 반환하지 않는 하위 리소스가
     * 없는 향수에 대해 404 를 내려면 존재 여부만 알면 됩니다.
     */
    boolean existsByIdAndActiveTrue(Long perfumeId);

    /** 진열대에 저장할 수 있는 활성 향수 엔티티를 조회합니다. */
    Optional<Perfume> findByIdAndActiveTrue(Long perfumeId);

    /**
     * Fragrantica 번호로 향수의 표시 정보를 한 번에 조회합니다. 자연어 추천이 씁니다.
     *
     * <p>AI 서버는 우리 DB 를 모르고 자기 데이터의 원본 번호로 향수를 지목합니다. 그 번호를
     * {@code perfume_id} 로 바꾸고 이름·브랜드를 채우는 것이 백엔드 몫입니다.
     *
     * <p><b>결과 순서에 기대지 마십시오.</b> {@code IN} 절은 보낸 순서를 지키지 않습니다.
     * 추천은 순위가 곧 의미라 호출한 쪽이 AI 가 정한 순서대로 다시 세워야 합니다. 쿼리에
     * {@code ORDER BY} 를 걸어 해결할 수 없어서 {@code fragranticaId} 를 함께 돌려줍니다.
     *
     * <p>비활성 향수는 빠집니다. 검색·상세와 같은 기준입니다. 적재되지 않은 향수도 없는
     * 것으로 나오므로, 보낸 수와 결과 수가 다른 것은 정상입니다.
     *
     * <p>{@code brand_id} 가 nullable 이라 {@code LEFT JOIN} 입니다. {@code INNER JOIN} 을
     * 쓰면 브랜드가 없는 향수가 추천 결과에서 조용히 사라집니다.
     */
    @Query("""
            SELECT new com.hyanghae.backend.perfume.repository.PerfumeIdentity(
                       p.fragranticaId, p.id, p.name, p.nameKo, b.name, b.nameKo)
            FROM Perfume p
            LEFT JOIN p.brand b
            WHERE p.fragranticaId IN :fragranticaIds
              AND p.active = true
            """)
    List<PerfumeIdentity> findIdentitiesByFragranticaIds(
            @Param("fragranticaIds") Collection<Long> fragranticaIds);
}
