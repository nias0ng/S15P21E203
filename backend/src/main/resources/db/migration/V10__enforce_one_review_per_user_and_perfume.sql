CREATE UNIQUE INDEX uk_perfume_reviews_user_perfume
    ON perfume_reviews (user_id, perfume_id)
    WHERE user_id IS NOT NULL;
