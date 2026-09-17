package com.hyanghae.backend.perfume;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.perfume.entity.PerfumeImageType;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 어떤 종류의 이미지가 뽑히는지 고정합니다.
 *
 * <p>향수 한 건에 일반 이미지와 종이 질감 이미지가 함께 있습니다. <b>어느 쪽이 뽑히느냐가
 * 화면의 옳고 그름을 가릅니다</b> — 종이 배경 위에 투명 배경 사진이 얹히면 어울리지 않습니다.
 *
 * <p>종류를 보지 않는 조회가 일반 이미지를 뽑는 것은 {@code display_order} 가 1번이라서입니다.
 * 그 전제가 깨지면(예: 적재 순서가 바뀌면) 검색·상세가 조용히 종이 질감을 쓰게 되므로 그쪽도
 * 함께 고정합니다.
 */
@IntegrationTest
@ActiveProfiles({"manual-test", "test"})
class PerfumeImagePreferenceIntegrationTest {

    private static final long BOTH = 1;
    private static final long ORIGINAL_ONLY = 2;
    private static final long PAPER_ONLY = 3;

    @Autowired
    private PerfumeImageRepository perfumeImageRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearData();
        insertPerfume(BOTH, "두 장 다 있는 향수");
        insertPerfume(ORIGINAL_ONLY, "일반만 있는 향수");
        insertPerfume(PAPER_ONLY, "종이 질감만 있는 향수");

        // 실제 적재와 같은 순서입니다 — 일반이 1번, 종이 질감이 2번.
        insertImage(BOTH, "both-original.png", 1, "ORIGINAL");
        insertImage(BOTH, "both-paper.png", 2, "PAPER_TEXTURE");
        insertImage(ORIGINAL_ONLY, "only-original.png", 1, "ORIGINAL");
        insertImage(PAPER_ONLY, "only-paper.png", 2, "PAPER_TEXTURE");
    }

    @AfterEach
    void cleanUp() {
        clearData();
    }

    /**
     * <b>이 변경의 본론입니다.</b> 종이 질감을 달라고 하면 종이 질감이 나와야 합니다.
     *
     * <p>고치기 전에는 {@code display_order} 만 봐서 항상 일반 이미지가 나왔습니다.
     */
    @Test
    void prefersPaperTextureWhenAsked() {
        Map<Long, String> picked = pick(PerfumeImageType.PAPER_TEXTURE);

        assertThat(picked.get(BOTH)).isEqualTo("both-paper.png");
        assertThat(picked.get(PAPER_ONLY)).isEqualTo("only-paper.png");
    }

    /**
     * 원하는 종류가 없으면 다른 종류로 넘어갑니다.
     *
     * <p>156개 향수에만 두 장이 다 있습니다. 없을 때 아무것도 주지 않으면 나머지 향수가 전부
     * 빈칸이 됩니다.
     */
    @Test
    void fallsBackToTheOtherTypeWhenPreferredIsMissing() {
        assertThat(pick(PerfumeImageType.PAPER_TEXTURE).get(ORIGINAL_ONLY))
                .isEqualTo("only-original.png");

        assertThat(pick(PerfumeImageType.ORIGINAL).get(PAPER_ONLY))
                .isEqualTo("only-paper.png");
    }

    /**
     * 일반 이미지를 달라고 하면 일반 이미지가 나옵니다. 종이 질감 쪽만 맞추다 이쪽이 뒤집히면
     * 검색·상세가 종이 질감을 쓰게 됩니다.
     */
    @Test
    void prefersOriginalWhenAsked() {
        assertThat(pick(PerfumeImageType.ORIGINAL).get(BOTH)).isEqualTo("both-original.png");
    }

    /**
     * 종류를 보지 않는 조회는 그대로 일반 이미지를 뽑습니다. 검색 · 상세 · 지도 · 커뮤니티가
     * 이것을 쓰므로 바뀌면 안 됩니다.
     *
     * <p>일반 이미지가 {@code display_order} 1번이라 그렇게 됩니다. <b>전제가 깨지면 이 단언이
     * 먼저 깨집니다.</b>
     */
    @Test
    void keepsPickingOriginalWhenTypeIsNotConsidered() {
        Map<Long, String> picked = perfumeImageRepository
                .findOrderedByPerfumeIds(List.of(BOTH, ORIGINAL_ONLY, PAPER_ONLY))
                .stream()
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, ignored) -> first));

        assertThat(picked.get(BOTH)).isEqualTo("both-original.png");
    }

    /**
     * 부르는 쪽들은 향수별 <b>첫 행</b>만 취합니다. 같은 방식으로 추립니다.
     */
    private Map<Long, String> pick(PerfumeImageType preferred) {
        return perfumeImageRepository
                .findOrderedByPerfumeIdsPreferring(
                        List.of(BOTH, ORIGINAL_ONLY, PAPER_ONLY), preferred)
                .stream()
                .filter(image -> image.imageUrl() != null)
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, ignored) -> first));
    }

    private void insertPerfume(long id, String name) {
        jdbcTemplate.update(
                "INSERT INTO perfumes (perfume_id, name, is_active) VALUES (?, ?, TRUE)", id, name);
    }

    private void insertImage(long perfumeId, String url, int displayOrder, String type) {
        jdbcTemplate.update("""
                INSERT INTO perfume_images (perfume_id, image_url, display_order, image_type)
                VALUES (?, ?, ?, ?)
                """, perfumeId, url, displayOrder, type);
    }

    private void clearData() {
        jdbcTemplate.update("DELETE FROM perfume_images");
        jdbcTemplate.update("DELETE FROM perfumes");
    }
}
