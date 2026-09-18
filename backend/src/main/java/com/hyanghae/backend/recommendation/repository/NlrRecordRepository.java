package com.hyanghae.backend.recommendation.repository;

import com.hyanghae.backend.recommendation.client.NlrRecommendResponse;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * 자연어 추천의 요청 · 결과 · 클릭 · 미매칭 · 만족도를 남깁니다.
 *
 * <p>탐색 기록({@code ExplorationLogRepository})과 같이 SQL 을 직접 씁니다. 엔티티를 두지 않는
 * 이유는 이 표들에 하는 일이 한 줄 넣기와 한 칸 갱신뿐이고, 읽는 쪽이 애플리케이션이 아니라
 * <b>사람이 돌리는 집계 질의</b>이기 때문입니다.
 *
 * <p>{@code nlr_unmatched_expressions.llm_accords} 는 이 DB 의 첫 배열 컬럼인데 지금은 값을
 * 넣지 않습니다. AI 계약이 그 값을 보내기 시작하면 그때 매핑을 정하면 됩니다.
 */
@Repository
public class NlrRecordRepository {

    /**
     * 요청 한 줄입니다. {@code requested_at} 은 표의 기본값 {@code now()} 를 씁니다.
     *
     * <p>{@code lexicon_version} 과 {@code prompt_sha256} 은 넣지 않습니다. AI 응답에 아직
     * 그 값이 없습니다 — 둘 다 {@code NULL} 허용이라 {@code INSERT} 가 막히지 않습니다.
     */
    private static final String INSERT_RECOMMENDATION = """
            INSERT INTO nlr_recommendations (
                user_id, raw_query, status, stage, source,
                core_accords, avoid_accords, candidate_count
            )
            VALUES (
                :userId, :rawQuery, :status, :stage, :source,
                :coreAccords, :avoidAccords, :candidateCount
            )
            """;

    /** 결과 한 줄입니다. 추천이 나간 순간 순위대로 들어가고 클릭은 나중에 갱신됩니다. */
    private static final String INSERT_ITEM = """
            INSERT INTO nlr_recommendation_items (recommendation_id, rank, perfume_id)
            VALUES (:recommendationId, :rank, :perfumeId)
            """;

    /**
     * 미매칭 표현 한 줄입니다.
     *
     * <p>{@code occurred_at} 을 값으로 주지 않고 {@code now()} 를 씁니다. AI 응답에 시각이 없고,
     * 애플리케이션이 만든 시각을 쓰면 인스턴스마다 시계가 조금씩 달라 같은 순간의 기록이
     * 뒤섞여 보입니다. 같은 요청 안이라 {@code requested_at} 과 사실상 같습니다.
     */
    private static final String INSERT_UNMATCHED = """
            INSERT INTO nlr_unmatched_expressions (
                recommendation_id, occurred_at, expression, normalized_key,
                unmatch_reason, entry_id
            )
            VALUES (
                :recommendationId, now(), :expression, :normalizedKey,
                :unmatchReason, :entryId
            )
            """;

    /**
     * 클릭을 남깁니다. <b>이미 눌린 줄은 건드리지 않습니다.</b>
     *
     * <p>{@code clicked_at IS NULL} 을 조건에 두어 처음 누른 시각을 지킵니다. 덮어쓰면 "추천을
     * 받고 얼마 만에 눌렀나" 가 마지막 클릭 기준으로 바뀝니다. 같은 카드를 여러 번 눌러도
     * 기록은 하나입니다.
     */
    private static final String MARK_CLICKED = """
            UPDATE nlr_recommendation_items
            SET clicked_at = now()
            WHERE recommendation_id = :recommendationId
              AND rank = :rank
              AND clicked_at IS NULL
            """;

    /** 그 순위의 결과가 있는지 봅니다. 없는 순위에 클릭이 오면 404 로 답해야 합니다. */
    private static final String SELECT_ITEM_PERFUME = """
            SELECT perfume_id
            FROM nlr_recommendation_items
            WHERE recommendation_id = :recommendationId AND rank = :rank
            """;

    /** 만족도입니다. 기본키가 {@code recommendation_id} 라 두 번 답하면 충돌합니다. */
    private static final String INSERT_FEEDBACK = """
            INSERT INTO nlr_feedbacks (recommendation_id, satisfaction, comment)
            VALUES (:recommendationId, :satisfaction, :comment)
            """;

    private static final String EXISTS_RECOMMENDATION = """
            SELECT EXISTS (
                SELECT 1 FROM nlr_recommendations WHERE recommendation_id = :recommendationId
            )
            """;

    private static final String EXISTS_FEEDBACK = """
            SELECT EXISTS (
                SELECT 1 FROM nlr_feedbacks WHERE recommendation_id = :recommendationId
            )
            """;

    /**
     * 보관 기간이 지난 요청의 원문을 비웁니다. <b>행은 지우지 않습니다.</b>
     *
     * <p>{@code nlr_recommendations} 를 지우면 {@code ON DELETE CASCADE} 로 결과 · 클릭 ·
     * 미매칭 · 만족도가 모두 함께 사라집니다. 사전을 키우는 데 필요한 {@code expression} 과
     * {@code normalized_key} 까지 없어집니다. 지울 것은 원문뿐입니다.
     *
     * <p>{@code raw_query} 가 {@code NOT NULL} 이라 {@code NULL} 이 아니라 빈 문자열로 비웁니다.
     * AI 쪽 파일 로그의 {@code purge_raw_text()} 도 같은 방식입니다.
     *
     * <p>이미 빈 줄은 건드리지 않습니다. 매일 돌면서 같은 줄을 다시 쓰면 갱신이 쌓입니다.
     */
    private static final String PURGE_RAW_QUERY = """
            UPDATE nlr_recommendations
            SET raw_query = ''
            WHERE requested_at < now() - make_interval(days => :days)
              AND raw_query <> ''
            """;

    /**
     * 만족도에 딸린 한마디도 함께 비웁니다.
     *
     * <p>기준 시각이 {@code answered_at} 이 아니라 <b>{@code requested_at}</b> 입니다. 설문을
     * 나중에 답하면 두 시각이 벌어지는데, 기준이 둘이면 같은 요청의 원문과 한마디가 다른 날
     * 지워집니다.
     *
     * <p>{@code satisfaction} 은 비우지 않습니다. {@code SATISFIED} 같은 값에는 개인정보가 없고
     * 그것이 만족도 지표의 본체입니다.
     */
    private static final String PURGE_COMMENT = """
            UPDATE nlr_feedbacks f
            SET comment = NULL
            FROM nlr_recommendations r
            WHERE r.recommendation_id = f.recommendation_id
              AND r.requested_at < now() - make_interval(days => :days)
              AND f.comment IS NOT NULL
            """;

    private final JdbcClient jdbcClient;

    public NlrRecordRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * 요청을 남기고 그 번호를 돌려줍니다. 나머지 세 표가 이 번호를 가리킵니다.
     *
     * @param userId 비로그인이면 {@code null} 입니다.
     */
    public long insertRecommendation(
            Long userId,
            String rawQuery,
            String status,
            String stage,
            String source,
            String coreAccords,
            String avoidAccords,
            Integer candidateCount
    ) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbcClient.sql(INSERT_RECOMMENDATION)
                .param("userId", userId)
                .param("rawQuery", rawQuery)
                .param("status", status)
                .param("stage", stage)
                .param("source", source)
                .param("coreAccords", coreAccords)
                .param("avoidAccords", avoidAccords)
                .param("candidateCount", candidateCount)
                .update(keys, "recommendation_id");
        Number key = keys.getKey();
        if (key == null) {
            throw new IllegalStateException("nlr_recommendations 가 번호를 돌려주지 않았습니다");
        }
        return key.longValue();
    }

    /** 결과를 순위대로 넣습니다. {@code perfumeIds} 의 순서가 곧 순위입니다. */
    public void insertItems(long recommendationId, List<Long> perfumeIds) {
        for (int index = 0; index < perfumeIds.size(); index++) {
            jdbcClient.sql(INSERT_ITEM)
                    .param("recommendationId", recommendationId)
                    .param("rank", index + 1)
                    .param("perfumeId", perfumeIds.get(index))
                    .update();
        }
    }

    public void insertUnmatched(
            long recommendationId,
            List<NlrRecommendResponse.Unmatched> expressions
    ) {
        for (NlrRecommendResponse.Unmatched expression : expressions) {
            jdbcClient.sql(INSERT_UNMATCHED)
                    .param("recommendationId", recommendationId)
                    .param("expression", expression.expression())
                    .param("normalizedKey", expression.normalizedKey())
                    .param("unmatchReason", expression.unmatchReason())
                    .param("entryId", expression.entryId())
                    .update();
        }
    }

    /** 그 순위의 향수입니다. 비어 있으면 그런 결과가 없었다는 뜻입니다. */
    public Optional<Long> findItemPerfumeId(long recommendationId, int rank) {
        return jdbcClient.sql(SELECT_ITEM_PERFUME)
                .param("recommendationId", recommendationId)
                .param("rank", rank)
                .query(Long.class)
                .optional();
    }

    /** 클릭을 남깁니다. 이미 눌려 있었으면 아무것도 바꾸지 않습니다. */
    public void markClicked(long recommendationId, int rank) {
        jdbcClient.sql(MARK_CLICKED)
                .param("recommendationId", recommendationId)
                .param("rank", rank)
                .update();
    }

    public boolean existsRecommendation(long recommendationId) {
        return Boolean.TRUE.equals(jdbcClient.sql(EXISTS_RECOMMENDATION)
                .param("recommendationId", recommendationId)
                .query(Boolean.class)
                .single());
    }

    public boolean existsFeedback(long recommendationId) {
        return Boolean.TRUE.equals(jdbcClient.sql(EXISTS_FEEDBACK)
                .param("recommendationId", recommendationId)
                .query(Boolean.class)
                .single());
    }

    public void insertFeedback(long recommendationId, String satisfaction, String comment) {
        jdbcClient.sql(INSERT_FEEDBACK)
                .param("recommendationId", recommendationId)
                .param("satisfaction", satisfaction)
                .param("comment", comment)
                .update();
    }

    /** 보관 기간이 지난 원문을 비우고 비운 줄 수를 돌려줍니다. */
    public int purgeRawQueries(int retentionDays) {
        return jdbcClient.sql(PURGE_RAW_QUERY).param("days", retentionDays).update();
    }

    /** 보관 기간이 지난 한마디를 비우고 비운 줄 수를 돌려줍니다. */
    public int purgeComments(int retentionDays) {
        return jdbcClient.sql(PURGE_COMMENT).param("days", retentionDays).update();
    }
}
