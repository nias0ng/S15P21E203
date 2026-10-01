package com.hyanghae.backend.recommendation.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 개인화 추천 후보를 계산하고 노출 기록을 저장합니다. */
@Repository
public class PersonalizedRecommendationRepository {

    private static final String TRY_LOCK_USER_RECOMMENDATION = """
            SELECT pg_try_advisory_xact_lock(:userId)
            """;

    private static final String EXISTS_TASTE_PROFILE = """
            SELECT EXISTS (
                SELECT 1
                FROM user_taste_tests t
                JOIN user_taste_test_selections s ON s.user_test_id = t.user_test_id
                WHERE t.user_id = :userId
            ) AS completed
            """;

    /**
     * 세 신호를 각각 코사인 유사도로 계산해 합칩니다.
     *
     * <p>취향 테스트 0.35, 적합도 평가 0.50, 최근 관심 0.15 입니다. 취향 테스트는 사용자가 고른
     * 향 계열과 순위(0.58·0.42)를 직접 씁니다. 적합도는 3점을 중립으로 두어 낮은 평가는 감점
     * 신호가 됩니다. 최근 관심은 30일만 보고 14일 단위 지수 감쇠를 적용합니다. 여러
     * 향수에서 반복된 어코드는 가산하고, 전체 카탈로그에 흔한 어코드는 IDF로 낮춥니다.
     *
     * <p>보유(OWNED) 향수만 제외하고 TRIED·WISH는 발견 후보에 남깁니다. 노출 이력은 점수에 섞지
     * 않고 서비스에서 3일 제외 규칙을 적용할 수 있도록 마지막 시각만 함께 돌려줍니다.
     */
    private static final String SELECT_TOP_CANDIDATES = """
            WITH taste_profile AS (
                SELECT s.scent_region_id,
                       CASE s.pick_order WHEN 1 THEN 0.58 ELSE 0.42 END AS preference
                FROM user_taste_tests t
                JOIN user_taste_test_selections s ON s.user_test_id = t.user_test_id
                WHERE t.user_id = :userId
            ),
            taste_norm AS (
                SELECT SQRT(SUM(preference * preference)) AS value
                FROM taste_profile
            ),
            family_norm AS (
                SELECT psf.perfume_id,
                       SQRT(SUM(psf.weight::double precision * psf.weight::double precision))
                           AS value
                FROM perfume_scent_families psf
                GROUP BY psf.perfume_id
            ),
            family_contributions AS (
                SELECT psf.perfume_id,
                       'TASTE' AS source,
                       r.name AS evidence_name,
                       psf.weight::double precision * tp.preference
                       / NULLIF(fn.value * (SELECT value FROM taste_norm), 0.0)
                       * 0.35 AS contribution
                FROM perfume_scent_families psf
                JOIN taste_profile tp ON tp.scent_region_id = psf.scent_region_id
                JOIN scent_regions r ON r.scent_region_id = psf.scent_region_id
                JOIN family_norm fn ON fn.perfume_id = psf.perfume_id
            ),
            rating_denominator AS (
                SELECT SUM(ABS((up.fit_rating::double precision - 3.0) / 2.0)) AS value
                FROM user_perfumes up
                WHERE up.user_id = :userId
                  AND up.fit_rating IS NOT NULL
            ),
            rating_profile AS (
                SELECT pa.accord_id,
                       (SUM(pa.weight::double precision
                            * ((up.fit_rating::double precision - 3.0) / 2.0))
                        / NULLIF((SELECT value FROM rating_denominator), 0.0)) AS preference
                FROM user_perfumes up
                JOIN perfume_accords pa ON pa.perfume_id = up.perfume_id
                WHERE up.user_id = :userId
                  AND up.fit_rating IS NOT NULL
                GROUP BY pa.accord_id
            ),
            rating_norm AS (
                SELECT SQRT(SUM(preference * preference)) AS value
                FROM rating_profile
            ),
            active_catalog AS (
                SELECT COUNT(*)::double precision AS perfume_count
                FROM perfumes
                WHERE is_active = TRUE
            ),
            accord_frequency AS (
                SELECT pa.accord_id, COUNT(*)::double precision AS perfume_count
                FROM perfume_accords pa
                JOIN perfumes p ON p.perfume_id = pa.perfume_id
                WHERE p.is_active = TRUE
                GROUP BY pa.accord_id
            ),
            recent_profile_raw AS (
                SELECT pa.accord_id,
                       SUM(pa.weight::double precision
                           * EXP(-EXTRACT(EPOCH FROM (NOW() - pv.viewed_at)) / 1209600.0))
                       * (1.0 + LN(COUNT(DISTINCT pv.perfume_id)::double precision))
                       * LN(1.0 + (SELECT perfume_count FROM active_catalog) / af.perfume_count)
                           AS preference
                FROM user_perfume_views pv
                JOIN perfume_accords pa ON pa.perfume_id = pv.perfume_id
                JOIN accord_frequency af ON af.accord_id = pa.accord_id
                WHERE pv.user_id = :userId
                  AND pv.viewed_at >= NOW() - INTERVAL '30 days'
                GROUP BY pa.accord_id, af.perfume_count
            ),
            recent_norm AS (
                SELECT SQRT(SUM(preference * preference)) AS value
                FROM recent_profile_raw
            ),
            accord_norm AS (
                SELECT pa.perfume_id,
                       SQRT(SUM(pa.weight::double precision * pa.weight::double precision))
                           AS value
                FROM perfume_accords pa
                GROUP BY pa.perfume_id
            ),
            rating_contributions AS (
                SELECT pa.perfume_id,
                       'FIT' AS source,
                       a.name AS evidence_name,
                       pa.weight::double precision * rp.preference
                       / NULLIF(an.value * (SELECT value FROM rating_norm), 0.0)
                       * 0.50 AS contribution
                FROM perfume_accords pa
                JOIN rating_profile rp ON rp.accord_id = pa.accord_id
                JOIN accords a ON a.accord_id = pa.accord_id
                JOIN accord_norm an ON an.perfume_id = pa.perfume_id
            ),
            recent_contributions AS (
                SELECT pa.perfume_id,
                       'RECENT' AS source,
                       a.name AS evidence_name,
                       pa.weight::double precision * rp.preference
                       / NULLIF(an.value * (SELECT value FROM recent_norm), 0.0)
                       * 0.15 AS contribution
                FROM perfume_accords pa
                JOIN recent_profile_raw rp ON rp.accord_id = pa.accord_id
                JOIN accords a ON a.accord_id = pa.accord_id
                JOIN accord_norm an ON an.perfume_id = pa.perfume_id
            ),
            contributions AS (
                SELECT perfume_id, source, evidence_name, contribution
                FROM family_contributions
                UNION ALL
                SELECT perfume_id, source, evidence_name, contribution
                FROM rating_contributions
                UNION ALL
                SELECT perfume_id, source, evidence_name, contribution
                FROM recent_contributions
            ),
            scored AS (
                SELECT perfume_id, SUM(contribution) AS score
                FROM contributions
                GROUP BY perfume_id
            ),
            top_candidates AS (
                SELECT s.perfume_id,
                       COALESCE(NULLIF(p.name_ko, ''), p.name) AS display_name,
                       p.name AS original_name,
                       NULLIF(p.name_ko, '') AS name_ko,
                       s.score
                FROM scored s
                JOIN perfumes p ON p.perfume_id = s.perfume_id
                WHERE EXISTS (SELECT 1 FROM taste_profile)
                  AND p.is_active = TRUE
                  AND s.score > 0.0
                  AND COALESCE(NULLIF(p.name_ko, ''), p.name) IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM user_perfumes owned
                      WHERE owned.user_id = :userId
                        AND owned.perfume_id = s.perfume_id
                        AND owned.ownership_status = 'OWNED'
                  )
                ORDER BY s.score DESC, s.perfume_id
                LIMIT :limit
            )
            SELECT candidate.perfume_id,
                   candidate.display_name,
                   candidate.original_name,
                   candidate.name_ko,
                   image.image_url,
                   candidate.score,
                   evidence.source AS evidence_source,
                   evidence.evidence_name,
                   evidence.evidence_key,
                   exposure.last_recommended_at
            FROM top_candidates candidate
            JOIN LATERAL (
                SELECT source, evidence_name, evidence_key
                FROM (
                    -- 상위 후보의 근거만 다시 계산합니다. 전체 contributions를 후보마다
                    -- 재탐색하지 않으며, 정규화 분모에는 해당 향수의 모든 성분을 포함합니다.
                    SELECT 'TASTE' AS source, r.name AS evidence_name,
                           r.code AS evidence_key,
                           psf.weight::double precision * tp.preference
                           / NULLIF((
                               SELECT SQRT(SUM(f.weight::double precision
                                               * f.weight::double precision))
                               FROM perfume_scent_families f
                               WHERE f.perfume_id = candidate.perfume_id
                           ) * (SELECT value FROM taste_norm), 0.0)
                           * 0.35 AS contribution
                    FROM perfume_scent_families psf
                    JOIN taste_profile tp ON tp.scent_region_id = psf.scent_region_id
                    JOIN scent_regions r ON r.scent_region_id = psf.scent_region_id
                    WHERE psf.perfume_id = candidate.perfume_id
                    UNION ALL
                    SELECT 'FIT', a.name, a.name,
                           pa.weight::double precision * rp.preference
                           / NULLIF((
                               SELECT SQRT(SUM(n.weight::double precision
                                               * n.weight::double precision))
                               FROM perfume_accords n
                               WHERE n.perfume_id = candidate.perfume_id
                           ) * (SELECT value FROM rating_norm), 0.0)
                           * 0.50
                    FROM perfume_accords pa
                    JOIN rating_profile rp ON rp.accord_id = pa.accord_id
                    JOIN accords a ON a.accord_id = pa.accord_id
                    WHERE pa.perfume_id = candidate.perfume_id
                    UNION ALL
                    SELECT 'RECENT', a.name, a.name,
                           pa.weight::double precision * rp.preference
                           / NULLIF((
                               SELECT SQRT(SUM(n.weight::double precision
                                               * n.weight::double precision))
                               FROM perfume_accords n
                               WHERE n.perfume_id = candidate.perfume_id
                           ) * (SELECT value FROM recent_norm), 0.0)
                           * 0.15
                    FROM perfume_accords pa
                    JOIN recent_profile_raw rp ON rp.accord_id = pa.accord_id
                    JOIN accords a ON a.accord_id = pa.accord_id
                    WHERE pa.perfume_id = candidate.perfume_id
                ) candidate_contributions
                WHERE contribution > 0.0
                  AND evidence_name IS NOT NULL
                ORDER BY contribution DESC, evidence_name, source
                LIMIT 1
            ) evidence ON TRUE
            LEFT JOIN LATERAL (
                SELECT i.image_url
                FROM perfume_images i
                WHERE i.perfume_id = candidate.perfume_id
                ORDER BY CASE WHEN i.image_type = 'ORIGINAL' THEN 0 ELSE 1 END,
                         i.display_order NULLS LAST,
                         i.image_id
                LIMIT 1
            ) image ON TRUE
            LEFT JOIN LATERAL (
                SELECT MAX(e.recommended_at) AS last_recommended_at
                FROM personalized_recommendation_exposures e
                WHERE e.user_id = :userId
                  AND e.perfume_id = candidate.perfume_id
            ) exposure ON TRUE
            ORDER BY candidate.score DESC, candidate.perfume_id
            """;

    private static final String SELECT_CACHE_STATE = """
            SELECT source_version,
                   calculated_source_version,
                   last_view_id,
                   calculated_at,
                   result_status
            FROM personalized_recommendation_cache_states
            WHERE user_id = :userId
            """;

    private static final String ENSURE_CACHE_STATE = """
            INSERT INTO personalized_recommendation_cache_states (user_id)
            VALUES (:userId)
            ON CONFLICT (user_id) DO NOTHING
            """;

    private static final String INCREMENT_SOURCE_VERSION = """
            INSERT INTO personalized_recommendation_cache_states (user_id, source_version)
            VALUES (:userId, 1)
            ON CONFLICT (user_id) DO UPDATE
            SET source_version = personalized_recommendation_cache_states.source_version + 1
            """;

    private static final String SELECT_MAX_VIEW_ID = """
            SELECT COALESCE(MAX(perfume_view_id), 0)
            FROM user_perfume_views
            WHERE user_id = :userId
            """;

    private static final String HAS_VIEW_THRESHOLD_AFTER = """
            SELECT COUNT(*) >= :threshold
            FROM (
                SELECT 1
                FROM user_perfume_views
                WHERE user_id = :userId
                  AND perfume_view_id > :lastViewId
                ORDER BY perfume_view_id
                LIMIT :threshold
            ) recent_views
            """;

    private static final String SELECT_CACHED_CANDIDATES = """
            SELECT cached.perfume_id,
                   COALESCE(NULLIF(p.name_ko, ''), p.name) AS display_name,
                   p.name AS original_name,
                   NULLIF(p.name_ko, '') AS name_ko,
                   image.image_url,
                   cached.score,
                   cached.evidence_source,
                   cached.evidence_name,
                   -- evidence_key 없이 저장된 행(V31 이전 버전이 쓴 행)은 계열 이름으로 code 를 찾습니다.
                   COALESCE(cached.evidence_key,
                            CASE WHEN cached.evidence_source = 'TASTE' THEN region.code
                                 ELSE cached.evidence_name END) AS evidence_key,
                   exposure.last_recommended_at
            FROM personalized_recommendation_candidates cached
            JOIN perfumes p ON p.perfume_id = cached.perfume_id
            LEFT JOIN scent_regions region
                   ON cached.evidence_key IS NULL
                  AND cached.evidence_source = 'TASTE'
                  AND region.name = cached.evidence_name
            LEFT JOIN LATERAL (
                SELECT i.image_url
                FROM perfume_images i
                WHERE i.perfume_id = cached.perfume_id
                ORDER BY CASE WHEN i.image_type = 'ORIGINAL' THEN 0 ELSE 1 END,
                         i.display_order NULLS LAST,
                         i.image_id
                LIMIT 1
            ) image ON TRUE
            LEFT JOIN LATERAL (
                SELECT MAX(e.recommended_at) AS last_recommended_at
                FROM personalized_recommendation_exposures e
                WHERE e.user_id = :userId
                  AND e.perfume_id = cached.perfume_id
            ) exposure ON TRUE
            WHERE cached.user_id = :userId
              AND p.is_active = TRUE
              AND COALESCE(NULLIF(p.name_ko, ''), p.name) IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM user_perfumes owned
                  WHERE owned.user_id = :userId
                    AND owned.perfume_id = cached.perfume_id
                    AND owned.ownership_status = 'OWNED'
              )
            ORDER BY cached.candidate_rank
            """;

    private static final String DELETE_CACHED_CANDIDATES = """
            DELETE FROM personalized_recommendation_candidates
            WHERE user_id = :userId
            """;

    private static final String INSERT_CACHED_CANDIDATE = """
            INSERT INTO personalized_recommendation_candidates
                (user_id, perfume_id, candidate_rank, score,
                 evidence_source, evidence_name, evidence_key)
            VALUES (:userId, :perfumeId, :rank, :score,
                    :evidenceSource, :evidenceName, :evidenceKey)
            """;

    private static final String UPDATE_CACHE_STATE = """
            UPDATE personalized_recommendation_cache_states
            SET calculated_source_version = :calculatedSourceVersion,
                last_view_id = :lastViewId,
                calculated_at = :calculatedAt,
                result_status = :resultStatus
            WHERE user_id = :userId
            """;

    private static final String INSERT_OFFER = """
            INSERT INTO personalized_recommendation_offers
                (recommendation_token, user_id, perfume_id, issued_at, expires_at)
            VALUES (:token, :userId, :perfumeId, :issuedAt, :expiresAt)
            """;

    private static final String DELETE_EXPIRED_OFFERS_FOR_USER = """
            DELETE FROM personalized_recommendation_offers
            WHERE user_id = :userId
              AND expires_at < :now
            """;

    private static final String EXISTS_COMPLETED_EXPOSURE = """
            SELECT EXISTS (
                SELECT 1
                FROM personalized_recommendation_exposures
                WHERE recommendation_token = :token
                  AND user_id = :userId
            )
            """;

    private static final String SELECT_VALID_OFFER_FOR_UPDATE = """
            SELECT perfume_id
            FROM personalized_recommendation_offers
            WHERE recommendation_token = :token
              AND user_id = :userId
              AND expires_at >= :now
            FOR UPDATE
            """;

    private static final String INSERT_EXPOSURE = """
            INSERT INTO personalized_recommendation_exposures
                (user_id, perfume_id, recommended_at, recommendation_token)
            VALUES (:userId, :perfumeId, :recommendedAt, :token)
            """;

    private static final String DELETE_OFFER = """
            DELETE FROM personalized_recommendation_offers
            WHERE recommendation_token = :token
            """;

    private final JdbcClient jdbcClient;

    public PersonalizedRecommendationRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 응시 기록과 한 개 이상의 선택이 모두 있어야 완료된 취향 테스트로 봅니다. */
    public boolean hasTasteProfile(Long userId) {
        return jdbcClient.sql(EXISTS_TASTE_PROFILE)
                .param("userId", userId)
                .query((rs, rowNum) -> rs.getBoolean("completed"))
                .single();
    }

    /** 계산 중인 요청을 기다리며 연결을 점유하지 않도록 잠금을 즉시 시도합니다. */
    public boolean tryLockForUser(Long userId) {
        return jdbcClient.sql(TRY_LOCK_USER_RECOMMENDATION)
                .param("userId", userId)
                .query(Boolean.class)
                .single();
    }

    public List<PersonalizedRecommendationCandidate> findTopCandidates(
            Long userId,
            int limit
    ) {
        return jdbcClient.sql(SELECT_TOP_CANDIDATES)
                .param("userId", userId)
                .param("limit", limit)
                .query((rs, rowNum) -> toCandidate(rs))
                .list();
    }

    private static PersonalizedRecommendationCandidate toCandidate(ResultSet rs)
            throws SQLException {
        return new PersonalizedRecommendationCandidate(
                rs.getLong("perfume_id"),
                rs.getString("display_name"),
                rs.getString("original_name"),
                rs.getString("name_ko"),
                rs.getString("image_url"),
                rs.getDouble("score"),
                rs.getString("evidence_source"),
                rs.getString("evidence_name"),
                rs.getString("evidence_key"),
                rs.getObject("last_recommended_at", OffsetDateTime.class));
    }

    public Optional<PersonalizedRecommendationCacheState> findCacheState(Long userId) {
        return jdbcClient.sql(SELECT_CACHE_STATE)
                .param("userId", userId)
                .query((rs, rowNum) -> new PersonalizedRecommendationCacheState(
                        rs.getLong("source_version"),
                        rs.getObject("calculated_source_version", Long.class),
                        rs.getLong("last_view_id"),
                        rs.getObject("calculated_at", OffsetDateTime.class),
                        rs.getString("result_status")))
                .optional();
    }

    public long ensureCacheStateAndGetSourceVersion(Long userId) {
        jdbcClient.sql(ENSURE_CACHE_STATE).param("userId", userId).update();
        return findCacheState(userId).orElseThrow().sourceVersion();
    }

    public void incrementSourceVersion(Long userId) {
        jdbcClient.sql(INCREMENT_SOURCE_VERSION).param("userId", userId).update();
    }

    public long findMaxViewId(Long userId) {
        return jdbcClient.sql(SELECT_MAX_VIEW_ID)
                .param("userId", userId)
                .query(Long.class)
                .single();
    }

    public boolean hasViewThresholdAfter(Long userId, long lastViewId, int threshold) {
        return jdbcClient.sql(HAS_VIEW_THRESHOLD_AFTER)
                .param("userId", userId)
                .param("lastViewId", lastViewId)
                .param("threshold", threshold)
                .query(Boolean.class)
                .single();
    }

    public List<PersonalizedRecommendationCandidate> findCachedCandidates(Long userId) {
        return jdbcClient.sql(SELECT_CACHED_CANDIDATES)
                .param("userId", userId)
                .query((rs, rowNum) -> toCandidate(rs))
                .list();
    }

    public void replaceCache(
            Long userId,
            List<PersonalizedRecommendationCandidate> candidates,
            long calculatedSourceVersion,
            long lastViewId,
            OffsetDateTime calculatedAt
    ) {
        jdbcClient.sql(DELETE_CACHED_CANDIDATES).param("userId", userId).update();
        for (int index = 0; index < candidates.size(); index++) {
            PersonalizedRecommendationCandidate candidate = candidates.get(index);
            jdbcClient.sql(INSERT_CACHED_CANDIDATE)
                    .param("userId", userId)
                    .param("perfumeId", candidate.perfumeId())
                    .param("rank", index + 1)
                    .param("score", candidate.score())
                    .param("evidenceSource", candidate.evidenceSource())
                    .param("evidenceName", candidate.evidenceName())
                    .param("evidenceKey", candidate.evidenceKey())
                    .update();
        }
        jdbcClient.sql(UPDATE_CACHE_STATE)
                .param("calculatedSourceVersion", calculatedSourceVersion)
                .param("lastViewId", lastViewId)
                .param("calculatedAt", calculatedAt)
                .param("resultStatus", candidates.isEmpty() ? "EMPTY" : "READY")
                .param("userId", userId)
                .update();
    }

    public void saveOffer(
            UUID token,
            Long userId,
            Long perfumeId,
            OffsetDateTime issuedAt,
            OffsetDateTime expiresAt
    ) {
        jdbcClient.sql(DELETE_EXPIRED_OFFERS_FOR_USER)
                .param("userId", userId)
                .param("now", issuedAt)
                .update();
        jdbcClient.sql(INSERT_OFFER)
                .param("token", token)
                .param("userId", userId)
                .param("perfumeId", perfumeId)
                .param("issuedAt", issuedAt)
                .param("expiresAt", expiresAt)
                .update();
    }

    public boolean hasCompletedExposure(UUID token, Long userId) {
        return jdbcClient.sql(EXISTS_COMPLETED_EXPOSURE)
                .param("token", token)
                .param("userId", userId)
                .query(Boolean.class)
                .single();
    }

    public Optional<Long> findValidOfferForUpdate(
            UUID token,
            Long userId,
            OffsetDateTime now
    ) {
        return jdbcClient.sql(SELECT_VALID_OFFER_FOR_UPDATE)
                .param("token", token)
                .param("userId", userId)
                .param("now", now)
                .query(Long.class)
                .optional();
    }

    public void saveExposure(
            UUID token,
            Long userId,
            Long perfumeId,
            OffsetDateTime recommendedAt
    ) {
        jdbcClient.sql(INSERT_EXPOSURE)
                .param("userId", userId)
                .param("perfumeId", perfumeId)
                .param("recommendedAt", recommendedAt)
                .param("token", token)
                .update();
    }

    public void deleteOffer(UUID token) {
        jdbcClient.sql(DELETE_OFFER).param("token", token).update();
    }
}
