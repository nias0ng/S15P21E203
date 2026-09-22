-- Frozen deployed query (5437071), for result equivalence checks.
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
       image.image_url,
       candidate.score,
       evidence.source AS evidence_source,
       evidence.evidence_name,
       exposure.last_recommended_at
FROM top_candidates candidate
JOIN LATERAL (
    SELECT source, evidence_name
    FROM contributions
    WHERE perfume_id = candidate.perfume_id
      AND contribution > 0.0
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
