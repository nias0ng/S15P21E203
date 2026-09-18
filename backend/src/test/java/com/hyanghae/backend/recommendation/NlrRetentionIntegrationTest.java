package com.hyanghae.backend.recommendation;

import static org.assertj.core.api.Assertions.assertThat;

import com.hyanghae.backend.recommendation.batch.NlrRetentionProperties;
import com.hyanghae.backend.recommendation.batch.NlrRetentionService;
import com.hyanghae.backend.support.IntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 보관 기간이 지난 사용자 원문을 비우는지 실제 PostgreSQL 위에서 검증합니다.
 *
 * <p><b>여기서 가장 중요한 단언은 "지워지지 않는다" 입니다.</b> 행을 지우면
 * {@code ON DELETE CASCADE} 로 결과 · 클릭 · 미매칭 · 만족도가 함께 사라지는데, 그것이 사전을
 * 키우는 근거 전부입니다. 개인정보를 지우려다 분석 자료를 같이 날리는 것이 이 기능에서 가장
 * 비싼 실수이고, 한 번 지우면 되돌릴 수 없습니다.
 */
@IntegrationTest
class NlrRetentionIntegrationTest {

    private static final int RETENTION_DAYS = 30;

    /** 보관 기간이 지난 요청입니다. */
    private static final long OLD = 1L;

    /** 아직 기간 안인 요청입니다. */
    private static final long RECENT = 2L;

    /** 보관 기간을 1분 넘긴 요청입니다. 지워져야 합니다. */
    private static final long JUST_OVER = 3L;

    /** 보관 기간에 1분 모자란 요청입니다. 남아야 합니다. */
    private static final long JUST_UNDER = 4L;

    @Autowired
    private NlrRetentionService retentionService;

    @Autowired
    private NlrRetentionProperties properties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixtures() {
        clearAll();
        jdbcTemplate.update("INSERT INTO brands (brand_id, name) VALUES (1, 'Test Brand')");
        jdbcTemplate.update("""
                INSERT INTO perfumes (perfume_id, brand_id, fragrantica_id, name, is_active)
                VALUES (1, 1, 111, 'Test Perfume', TRUE)
                """);

        insertRecommendation(OLD, "40일 전에 물어본 문장입니다", 40);
        insertRecommendation(RECENT, "10일 전에 물어본 문장입니다", 10);

        // 경계 바로 양쪽입니다. 부등호가 <= 로 바뀌거나 기준일이 31 로 밀리면 여기서 걸립니다.
        insertRecommendationAt(JUST_OVER, "30일하고 1분 전입니다", RETENTION_DAYS, 1);
        insertRecommendationAt(JUST_UNDER, "30일에서 1분 모자랍니다", RETENTION_DAYS, -1);
        insertFeedback(JUST_OVER, "NEUTRAL", "30일하고 1분 전 한마디");
        insertFeedback(JUST_UNDER, "NEUTRAL", "30일에서 1분 모자란 한마디");

        insertFeedback(OLD, "SATISFIED", "40일 전 한마디");
        insertFeedback(RECENT, "DISSATISFIED", "10일 전 한마디");

        insertItem(OLD);
        insertUnmatched(OLD, "여성스러운");
    }

    @AfterEach
    void cleanUp() {
        clearAll();
    }

    /** 보관 기간이 지난 원문만 비웁니다. */
    @Test
    void clearsRawQueryPastRetention() {
        retentionService.purge();

        assertThat(rawQuery(OLD)).isEmpty();
        assertThat(rawQuery(RECENT)).isEqualTo("10일 전에 물어본 문장입니다");
    }

    /**
     * 한마디도 함께 비웁니다.
     *
     * <p>사용자가 직접 쓴 글이라 원문과 성질이 같습니다. 한쪽만 비우면 개인정보가 절반 남습니다.
     */
    @Test
    void clearsCommentPastRetention() {
        retentionService.purge();

        assertThat(comment(OLD)).isNull();
        assertThat(comment(RECENT)).isEqualTo("10일 전 한마디");
    }

    /**
     * <b>행은 하나도 지워지지 않습니다.</b>
     *
     * <p>이 단언이 깨지면 {@code DELETE} 로 바뀐 것입니다. 그러면 결과 · 클릭 · 미매칭 ·
     * 만족도가 {@code ON DELETE CASCADE} 로 함께 사라집니다.
     */
    @Test
    void keepsEveryRow() {
        retentionService.purge();

        assertThat(count("nlr_recommendations")).isEqualTo(4);
        assertThat(count("nlr_recommendation_items")).isEqualTo(1);
        assertThat(count("nlr_unmatched_expressions")).isEqualTo(1);
        assertThat(count("nlr_feedbacks")).isEqualTo(4);
    }

    /**
     * 분석에 쓰는 값은 보관 기간과 무관하게 남습니다.
     *
     * <p>사전을 키우는 데 필요한 것은 미매칭 표현이고, 만족도 지표의 본체는
     * {@code satisfaction} 입니다. 원문은 표본을 눈으로 볼 때 쓰는 것이라 없어도 집계가 돕니다.
     */
    @Test
    void keepsAnalysisValues() {
        retentionService.purge();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT expression FROM nlr_unmatched_expressions WHERE recommendation_id = ?",
                String.class, OLD))
                .isEqualTo("여성스러운");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT satisfaction FROM nlr_feedbacks WHERE recommendation_id = ?",
                String.class, OLD))
                .isEqualTo("SATISFIED");
    }

    /**
     * 기준 시각이 {@code requested_at} 입니다.
     *
     * <p>{@code answered_at} 을 기준으로 잡으면 설문을 늦게 답한 요청의 한마디가 원문보다 나중에
     * 지워집니다. 같은 요청의 개인정보가 다른 날 사라지는 것은 설명하기 어렵습니다.
     */
    @Test
    void usesRequestedAtNotAnsweredAt() {
        // 오래된 요청에 오늘 답한 만족도입니다. answered_at 기준이면 안 지워집니다.
        jdbcTemplate.update(
                "UPDATE nlr_feedbacks SET answered_at = now() WHERE recommendation_id = ?", OLD);

        retentionService.purge();

        assertThat(comment(OLD)).isNull();
    }

    /**
     * 이미 비운 줄은 다시 쓰지 않습니다.
     *
     * <p>매일 도는 배치라 같은 줄을 계속 갱신하면 갱신이 쌓입니다. 두 번째 실행에서 바뀌는 것이
     * 없어야 합니다.
     */
    @Test
    void doesNotTouchAlreadyClearedRows() {
        retentionService.purge();
        String before = rawQuery(RECENT);

        retentionService.purge();

        assertThat(rawQuery(OLD)).isEmpty();
        assertThat(rawQuery(RECENT)).isEqualTo(before);
        assertThat(count("nlr_recommendations")).isEqualTo(4);
    }

    /**
     * 경계 바로 양쪽을 만듭니다. 분 단위가 필요해 따로 둡니다.
     *
     * @param extraMinutes 양수면 그만큼 더 오래된 것, 음수면 그만큼 덜 오래된 것입니다.
     */
    private void insertRecommendationAt(long id, String query, int daysAgo, int extraMinutes) {
        jdbcTemplate.update("""
                INSERT INTO nlr_recommendations
                    (recommendation_id, raw_query, status, requested_at)
                VALUES (?, ?, 'OK', now() - make_interval(days => ?, mins => ?))
                """, id, query, daysAgo, extraMinutes);
    }

    private void insertRecommendation(long id, String query, int daysAgo) {
        jdbcTemplate.update("""
                INSERT INTO nlr_recommendations
                    (recommendation_id, raw_query, status, requested_at)
                VALUES (?, ?, 'OK', now() - make_interval(days => ?))
                """, id, query, daysAgo);
    }

    /**
     * 경계 바로 양쪽을 가릅니다.
     *
     * <p>40일과 10일만으로는 부등호가 {@code <=} 로 바뀌거나 기준일이 29 · 31 로 밀려도 안
     * 걸립니다. 하루 차이가 아니라 <b>1분 차이</b>로 갈리는지 봐야 기준이 정확한지 알 수
     * 있습니다.
     *
     * <p>보관 기간 정책은 "30일이 지나면 지운다" 이고, 30일에 1분 모자란 것은 아직 지날 것이
     * 안 지난 것입니다.
     */
    @Test
    void clearsOnlyPastTheExactBoundary() {
        retentionService.purge();

        assertThat(rawQuery(JUST_OVER)).isEmpty();
        assertThat(comment(JUST_OVER)).isNull();

        assertThat(rawQuery(JUST_UNDER)).isEqualTo("30일에서 1분 모자랍니다");
        assertThat(comment(JUST_UNDER)).isEqualTo("30일에서 1분 모자란 한마디");
    }

    /** 경계 양쪽 모두 행과 만족도 값은 남습니다. */
    @Test
    void keepsRowsOnBothSidesOfTheBoundary() {
        retentionService.purge();

        assertThat(count("nlr_recommendations")).isEqualTo(4);
        assertThat(queryForSatisfaction(JUST_OVER)).isEqualTo("NEUTRAL");
        assertThat(queryForSatisfaction(JUST_UNDER)).isEqualTo("NEUTRAL");
    }

    private String queryForSatisfaction(long id) {
        return jdbcTemplate.queryForObject(
                "SELECT satisfaction FROM nlr_feedbacks WHERE recommendation_id = ?",
                String.class, id);
    }

    private void insertFeedback(long id, String satisfaction, String comment) {
        jdbcTemplate.update("""
                INSERT INTO nlr_feedbacks (recommendation_id, satisfaction, comment)
                VALUES (?, ?, ?)
                """, id, satisfaction, comment);
    }

    private void insertItem(long id) {
        jdbcTemplate.update("""
                INSERT INTO nlr_recommendation_items (recommendation_id, rank, perfume_id)
                VALUES (?, 1, 1)
                """, id);
    }

    private void insertUnmatched(long id, String expression) {
        jdbcTemplate.update("""
                INSERT INTO nlr_unmatched_expressions
                    (recommendation_id, occurred_at, expression, normalized_key, unmatch_reason)
                VALUES (?, now(), ?, ?, 'NOT_IN_LEXICON')
                """, id, expression, expression);
    }

    private String rawQuery(long id) {
        return jdbcTemplate.queryForObject(
                "SELECT raw_query FROM nlr_recommendations WHERE recommendation_id = ?",
                String.class, id);
    }

    private String comment(long id) {
        return jdbcTemplate.queryForObject(
                "SELECT comment FROM nlr_feedbacks WHERE recommendation_id = ?",
                String.class, id);
    }

    private int count(String table) {
        Integer count = jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Integer.class);
        return count == null ? 0 : count;
    }

    private void clearAll() {
        jdbcTemplate.update("DELETE FROM nlr_recommendations");
        jdbcTemplate.update("DELETE FROM perfumes");
        jdbcTemplate.update("DELETE FROM brands");
    }

    /**
     * 팀이 정한 보관 기간이 설정 기본값과 같은지 봅니다.
     *
     * <p>이 값이 바뀌면 위 테스트들의 40일·10일 구분이 뜻을 잃습니다. 기본값을 조용히 늘리면
     * 개인정보가 정해진 기간보다 오래 남는데, 아무도 모릅니다.
     *
     * <p><b>기본이 켜짐인 것도 함께 봅니다.</b> 꺼 두면 정책이 있는데 실행이 없는 상태가
     * 됩니다 — 지켜지고 있다고 착각하게 됩니다.
     */
    @Test
    void retentionDefaultsMatchTheDecision() {
        assertThat(properties.retentionDays()).isEqualTo(RETENTION_DAYS);
        assertThat(properties.enabled()).isTrue();
    }
}
