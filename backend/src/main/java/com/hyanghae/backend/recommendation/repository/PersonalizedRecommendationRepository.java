package com.hyanghae.backend.recommendation.repository;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 개인화 추천 후보를 계산하고 노출 기록을 저장합니다. */
@Repository
public class PersonalizedRecommendationRepository {

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
            family_scores AS (
                SELECT psf.perfume_id,
                       SUM(psf.weight::double precision * tp.preference)
                       / NULLIF(fn.value * (SELECT value FROM taste_norm), 0.0)
                       * 0.35 AS score
                FROM perfume_scent_families psf
                JOIN taste_profile tp ON tp.scent_region_id = psf.scent_region_id
                JOIN family_norm fn ON fn.perfume_id = psf.perfume_id
                GROUP BY psf.perfume_id, fn.value
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
            rating_scores AS (
                SELECT pa.perfume_id,
                       SUM(pa.weight::double precision * rp.preference)
                       / NULLIF(an.value * (SELECT value FROM rating_norm), 0.0)
                       * 0.50 AS score
                FROM perfume_accords pa
                JOIN rating_profile rp ON rp.accord_id = pa.accord_id
                JOIN accord_norm an ON an.perfume_id = pa.perfume_id
                GROUP BY pa.perfume_id, an.value
            ),
            recent_scores AS (
                SELECT pa.perfume_id,
                       SUM(pa.weight::double precision * rp.preference)
                       / NULLIF(an.value * (SELECT value FROM recent_norm), 0.0)
                       * 0.15 AS score
                FROM perfume_accords pa
                JOIN recent_profile_raw rp ON rp.accord_id = pa.accord_id
                JOIN accord_norm an ON an.perfume_id = pa.perfume_id
                GROUP BY pa.perfume_id, an.value
            ),
            candidate_ids AS (
                SELECT perfume_id FROM family_scores
                UNION
                SELECT perfume_id FROM rating_scores
                UNION
                SELECT perfume_id FROM recent_scores
            ),
            scored AS (
                SELECT candidate_ids.perfume_id,
                       COALESCE(fs.score, 0.0)
                       + COALESCE(rs.score, 0.0)
                       + COALESCE(recent.score, 0.0) AS score
                FROM candidate_ids
                LEFT JOIN family_scores fs USING (perfume_id)
                LEFT JOIN rating_scores rs USING (perfume_id)
                LEFT JOIN recent_scores recent USING (perfume_id)
            )
            SELECT s.perfume_id,
                   COALESCE(NULLIF(p.name_ko, ''), p.name) AS display_name,
                   image.image_url,
                   s.score,
                   evidence.source AS evidence_source,
                   evidence.evidence_name,
                   exposure.last_recommended_at
            FROM scored s
            JOIN perfumes p ON p.perfume_id = s.perfume_id
            JOIN LATERAL (
                SELECT source, evidence_name
                FROM (
                    SELECT 'TASTE' AS source,
                           r.name AS evidence_name,
                           psf.weight::double precision * tp.preference
                           / NULLIF(fn.value * (SELECT value FROM taste_norm), 0.0)
                           * 0.35 AS contribution
                    FROM perfume_scent_families psf
                    JOIN taste_profile tp ON tp.scent_region_id = psf.scent_region_id
                    JOIN scent_regions r ON r.scent_region_id = psf.scent_region_id
                    JOIN family_norm fn ON fn.perfume_id = psf.perfume_id
                    WHERE psf.perfume_id = s.perfume_id
                    UNION ALL
                    SELECT 'FIT', a.name,
                           pa.weight::double precision * rp.preference
                           / NULLIF(an.value * (SELECT value FROM rating_norm), 0.0)
                           * 0.50
                    FROM perfume_accords pa
                    JOIN rating_profile rp ON rp.accord_id = pa.accord_id
                    JOIN accords a ON a.accord_id = pa.accord_id
                    JOIN accord_norm an ON an.perfume_id = pa.perfume_id
                    WHERE pa.perfume_id = s.perfume_id
                      AND rp.preference > 0.0
                    UNION ALL
                    SELECT 'RECENT', a.name,
                           pa.weight::double precision * rp.preference
                           / NULLIF(an.value * (SELECT value FROM recent_norm), 0.0)
                           * 0.15
                    FROM perfume_accords pa
                    JOIN recent_profile_raw rp ON rp.accord_id = pa.accord_id
                    JOIN accords a ON a.accord_id = pa.accord_id
                    JOIN accord_norm an ON an.perfume_id = pa.perfume_id
                    WHERE pa.perfume_id = s.perfume_id
                ) contributions
                WHERE contribution > 0.0
                  AND evidence_name IS NOT NULL
                ORDER BY contribution DESC, evidence_name, source
                LIMIT 1
            ) evidence ON TRUE
            LEFT JOIN LATERAL (
                SELECT i.image_url
                FROM perfume_images i
                WHERE i.perfume_id = s.perfume_id
                ORDER BY CASE WHEN i.image_type = 'ORIGINAL' THEN 0 ELSE 1 END,
                         i.display_order NULLS LAST,
                         i.image_id
                LIMIT 1
            ) image ON TRUE
            LEFT JOIN LATERAL (
                SELECT MAX(e.recommended_at) AS last_recommended_at
                FROM personalized_recommendation_exposures e
                WHERE e.user_id = :userId
                  AND e.perfume_id = s.perfume_id
            ) exposure ON TRUE
            WHERE p.is_active = TRUE
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
            """;

    private static final String INSERT_EXPOSURE = """
            INSERT INTO personalized_recommendation_exposures
                (user_id, perfume_id, recommended_at)
            VALUES (:userId, :perfumeId, :recommendedAt)
            """;

    private final JdbcClient jdbcClient;

    public PersonalizedRecommendationRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<PersonalizedRecommendationCandidate> findTopCandidates(
            Long userId,
            int limit
    ) {
        return jdbcClient.sql(SELECT_TOP_CANDIDATES)
                .param("userId", userId)
                .param("limit", limit)
                .query((rs, rowNum) -> new PersonalizedRecommendationCandidate(
                        rs.getLong("perfume_id"),
                        rs.getString("display_name"),
                        rs.getString("image_url"),
                        rs.getDouble("score"),
                        rs.getString("evidence_source"),
                        rs.getString("evidence_name"),
                        rs.getObject("last_recommended_at", OffsetDateTime.class)))
                .list();
    }

    public void saveExposure(Long userId, Long perfumeId, OffsetDateTime recommendedAt) {
        jdbcClient.sql(INSERT_EXPOSURE)
                .param("userId", userId)
                .param("perfumeId", perfumeId)
                .param("recommendedAt", recommendedAt)
                .update();
    }
}
