package com.hyanghae.backend.perfume.repository;

import com.hyanghae.backend.perfume.entity.Brand;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 브랜드 목록을 읽습니다.
 *
 * <p><b>네이티브 쿼리입니다.</b> 한국어 이름순이 {@code COLLATE "C"} 를 써야 하는데 JPQL 에는
 * collation 을 지정하는 문법이 없습니다. 하나만 네이티브로 두면 같은 목록을 두 가지 방법으로
 * 짜게 되므로 셋을 맞췄습니다.
 *
 * <p>페이지가 없습니다. 브랜드 페이지는 전부를 한 화면에 뿌립니다. 지금 71개이고, 브랜드 수는
 * 향수처럼 늘어나는 값이 아닙니다. 화면이 페이지를 요구하면 그때 더합니다.
 */
@Repository
public interface BrandRepository extends JpaRepository<Brand, Long> {

    /**
     * 목록 한 줄에 실을 값입니다.
     *
     * <p>향수 수가 없습니다. 화면이 카드에 그리지 않기로 했습니다. 브랜드가 7,793개라 필드 하나가
     * 133KB 인데, 쓰지 않을 값에 낼 크기가 아닙니다.
     */
    String BRAND_COLUMNS = """
            SELECT b.brand_id AS brandId,
                   b.name AS name,
                   b.name_ko AS nameKo,
                   b.logo_url AS logoUrl
            """;

    String BRAND_FROM = "FROM brands b\n";

    /**
     * 향수 많은 순에만 붙이는 조인입니다.
     *
     * <p>세는 값이 응답에 나가지 않으므로 다른 정렬에서는 붙일 이유가 없습니다. 그냥 두면 이름순
     * 조회가 쓰지도 않을 13만 행을 매번 붙입니다.
     *
     * <p>왼쪽 조인인 이유는 향수가 없는 브랜드도 목록에 나와야 하기 때문입니다. 안쪽 조인으로
     * 두면 그런 브랜드가 통째로 사라집니다.
     *
     * <p><b>활성 향수만 셉니다.</b> 조건을 {@code ON} 에 두는 이유가 여기입니다 — {@code WHERE}
     * 로 옮기면 활성 향수가 하나도 없는 브랜드가 왼쪽 조인과 무관하게 빠집니다.
     */
    String BRAND_COUNT_JOIN =
            "LEFT JOIN perfumes p ON p.brand_id = b.brand_id AND p.is_active = TRUE\n";

    /**
     * 목록이 보는 범위입니다. <b>정렬 셋이 나눠 씁니다.</b>
     *
     * <p>따로 적어 두면 한쪽만 고쳤을 때 정렬에 따라 다른 브랜드가 나옵니다. 화면은 정렬 칩만
     * 눌렀는데 목록이 바뀌는 셈입니다.
     *
     * <p>내려간 브랜드는 뺍니다. 검색어를 주면 <b>두 이름 모두</b>에서 부분 일치를 찾습니다.
     * 화면의 검색창 하나가 한국어와 영문을 모두 받아야 하기 때문입니다.
     *
     * <p>{@code CAST} 를 쓰는 이유는 PostgreSQL 이 바인딩된 {@code NULL} 의 타입을 모르면 비교를
     * 거부하기 때문입니다. 게시글 목록도 같은 사정입니다.
     *
     * <p>{@code ESCAPE '\\'} 를 붙입니다. 사용자가 {@code %} 나 {@code _} 를 치면 그것이 와일드
     * 카드로 해석되어 엉뚱하게 전체가 걸립니다. 서비스가 미리 막아 보내고 여기서 받습니다.
     *
     * <p><b>이름에서 공백을 지우고 견줍니다.</b> 브랜드 7,873곳 중 5,042곳의 한국어 이름에 공백이
     * 있어('빅토리아 시크릿'), 붙여 친 검색어가 0건이 되고 있었습니다. 검색어 쪽도 서비스가 같이
     * 지웁니다({@code BrandService.likePattern}) — 한쪽만 지우면 반대 방향, 즉 띄어 친 검색어가
     * 도로 안 걸립니다.
     *
     * <p>{@code REPLACE} 는 지금 규모에서 값이 쌉니다. 브랜드가 7,873행이고 어차피 앞에 와일드
     * 카드가 붙는 {@code ILIKE} 라 인덱스를 타지 못해, 전에도 전부 훑고 있었습니다. 브랜드가
     * 크게 늘면 공백 없는 이름에 식 인덱스를 거는 편이 낫습니다.
     */
    String BRAND_WHERE = """
            WHERE b.is_active = TRUE
              AND (CAST(:keyword AS VARCHAR) IS NULL
                   OR REPLACE(b.name, ' ', '') ILIKE :keyword ESCAPE '\\'
                   OR REPLACE(b.name_ko, ' ', '') ILIKE :keyword ESCAPE '\\')
            """;

    /** 향수 많은 순만 묶습니다. 조인이 브랜드마다 향수 수만큼 줄을 만들기 때문입니다. */
    String BRAND_GROUP_BY = "GROUP BY b.brand_id, b.name, b.name_ko, b.logo_url\n";

    /**
     * 한국어 이름 가나다순입니다.
     *
     * <p>{@code COLLATE "C"} 는 코드포인트 순인데, 완성형 한글(U+AC00~U+D7A3)이 초성→중성→종성
     * 순으로 배열되어 있어 그것이 곧 가나다순입니다. 데이터베이스 기본값인 {@code en_US.utf8} 은
     * 한글 규칙이 없어 '디올' 다음에 '딥디크' 가 오지 않습니다.
     *
     * <p>한국어 이름이 없는 브랜드는 뒤로 밉니다. 아직 대부분이 여기 해당합니다. 뒤에 영문 이름과
     * 브랜드 번호를 이어 붙여 순서를 확정합니다 — 이름이 없는 브랜드들끼리도 순서가 정해져야
     * 화면을 다시 열 때 같은 차례로 보입니다.
     */
    String BRAND_ORDER_NAME_KO =
            "ORDER BY b.name_ko COLLATE \"C\" NULLS LAST, b.name, b.brand_id";

    /**
     * 영어 이름 abc 순입니다. 기본 collation 그대로입니다.
     *
     * <p>여기에 {@code COLLATE "C"} 를 쓰면 대문자가 전부 앞으로 가서 'Zara' 가 'adidas' 보다
     * 앞에 옵니다. 기본값은 대소문자를 무시해 'Bentley' 다음에 'BMW Fragrances' 를 놓습니다.
     */
    String BRAND_ORDER_NAME_EN = "ORDER BY b.name NULLS LAST, b.brand_id";

    /** 향수가 많은 순입니다. 같은 수가 흔하므로 영문 이름과 번호까지 이어 붙입니다. */
    String BRAND_ORDER_PERFUME_COUNT =
            "ORDER BY COUNT(p.perfume_id) DESC, b.name NULLS LAST, b.brand_id";

    @Query(value = BRAND_COLUMNS + BRAND_FROM + BRAND_WHERE + BRAND_ORDER_NAME_KO,
            nativeQuery = true)
    List<BrandSummaryRow> findAllByNameKo(@Param("keyword") String keyword);

    @Query(value = BRAND_COLUMNS + BRAND_FROM + BRAND_WHERE + BRAND_ORDER_NAME_EN,
            nativeQuery = true)
    List<BrandSummaryRow> findAllByNameEn(@Param("keyword") String keyword);

    @Query(value = BRAND_COLUMNS + BRAND_FROM + BRAND_COUNT_JOIN + BRAND_WHERE + BRAND_GROUP_BY
            + BRAND_ORDER_PERFUME_COUNT, nativeQuery = true)
    List<BrandSummaryRow> findAllByPerfumeCount(@Param("keyword") String keyword);

    /**
     * 브랜드 한 곳입니다. 내려간 브랜드는 없는 것으로 봅니다.
     *
     * <p>목록과 달리 향수 수를 함께 셉니다. 한 건이라 세는 비용이 문제가 되지 않고, 상세
     * 화면이 쓰는 값입니다.
     *
     * <p>세는 조건은 목록의 향수 많은 순 정렬과 같습니다 — <b>활성 향수만</b> 셉니다. 두 곳이
     * 다르면 목록에서 42개라던 브랜드가 상세에서 다른 수로 보입니다.
     */
    @Query(value = """
            SELECT b.brand_id AS brandId,
                   b.name AS name,
                   b.name_ko AS nameKo,
                   b.logo_url AS logoUrl,
                   CAST(COUNT(p.perfume_id) AS integer) AS perfumeCount
            FROM brands b
            LEFT JOIN perfumes p ON p.brand_id = b.brand_id AND p.is_active = TRUE
            WHERE b.brand_id = :brandId
              AND b.is_active = TRUE
            GROUP BY b.brand_id, b.name, b.name_ko, b.logo_url
            """, nativeQuery = true)
    Optional<BrandDetailRow> findDetailById(@Param("brandId") Long brandId);
}
