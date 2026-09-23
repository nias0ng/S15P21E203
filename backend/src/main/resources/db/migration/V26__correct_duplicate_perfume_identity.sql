-- 향 지도 5위 에클라 드 아르페쥬는 크롤링 중복인 Fragrantica 9110이 아니라
-- 정식 레코드 988을 사용해야 합니다. 운영 DB에서 이미 노출된 perfume_id=5는 사용자 진열대,
-- 후기와 게시글이 참조할 수 있으므로 번호를 유지합니다.
--
-- 기존 정식 레코드 행은 참조 데이터 유실을 피하기 위해 비활성화하고 fragrantica_id를 비웁니다.
-- 검색·상세·추천은 is_active=true만 노출하므로 사용자에게는 중복 향수가 제거됩니다.
DO $$
DECLARE
    duplicate_id BIGINT;
    canonical perfumes%ROWTYPE;
BEGIN
    SELECT perfume_id
    INTO duplicate_id
    FROM perfumes
    WHERE fragrantica_id = 9110;

    SELECT *
    INTO canonical
    FROM perfumes
    WHERE fragrantica_id = 988;

    IF duplicate_id IS NOT NULL AND duplicate_id <> 5 THEN
        RAISE EXCEPTION
            'Fragrantica 9110 중복 향수의 perfume_id가 5가 아닙니다: %', duplicate_id;
    END IF;

    IF duplicate_id IS NOT NULL THEN
        IF canonical.perfume_id IS NOT NULL AND canonical.perfume_id <> duplicate_id THEN
            -- 공개 ID 5의 사용자 활동 관계는 그대로 두고, 카탈로그에서 관리하는 정식
            -- 이미지·노트·accord만 988 행에서 옮깁니다. seed를 별도로 실행하지 않아도
            -- 애플리케이션 배포 직후부터 상세 정보가 정식 레코드와 일치해야 합니다.
            IF EXISTS (SELECT 1 FROM perfume_accords
                       WHERE perfume_id = canonical.perfume_id) THEN
                DELETE FROM perfume_accords WHERE perfume_id = duplicate_id;
                UPDATE perfume_accords
                SET perfume_id = duplicate_id
                WHERE perfume_id = canonical.perfume_id;
            END IF;

            IF EXISTS (SELECT 1 FROM perfume_notes
                       WHERE perfume_id = canonical.perfume_id) THEN
                DELETE FROM perfume_notes WHERE perfume_id = duplicate_id;
                UPDATE perfume_notes
                SET perfume_id = duplicate_id
                WHERE perfume_id = canonical.perfume_id;
            END IF;

            DELETE FROM perfume_images target
            USING perfume_images source
            WHERE target.perfume_id = duplicate_id
              AND source.perfume_id = canonical.perfume_id
              AND target.image_type = source.image_type;

            UPDATE perfume_images
            SET perfume_id = duplicate_id
            WHERE perfume_id = canonical.perfume_id;

            UPDATE perfumes
            SET fragrantica_id       = NULL,
                korea_selection_rank = NULL,
                korea_selection_basis = NULL,
                is_active            = FALSE
            WHERE perfume_id = canonical.perfume_id;
        END IF;

        UPDATE perfumes
        SET brand_id                 = COALESCE(canonical.brand_id, brand_id),
            name                     = 'Eclat d’Arpège',
            name_ko                  = '에클라 드 아르페쥬',
            gender                   = COALESCE(canonical.gender, gender),
            description              = COALESCE(canonical.description, description),
            concentration            = COALESCE(canonical.concentration, concentration),
            is_active                = TRUE,
            fragrantica_id           = 988,
            release_year             = 2002,
            fragrantica_rating_count = COALESCE(canonical.fragrantica_rating_count,
                                                 fragrantica_rating_count)
        WHERE perfume_id = duplicate_id;

        -- 지도용 종이 질감 이미지는 기존 9110 행에만 있었으므로 공개 ID에 유지하되
        -- S3 경로를 정식 Fragrantica ID 기준으로 바꿉니다.
        UPDATE perfume_images
        SET image_url = replace(image_url, '/perfumes/9110/', '/perfumes/988/')
        WHERE perfume_id = duplicate_id
          AND image_url LIKE '%/perfumes/9110/%';
    END IF;

    UPDATE perfumes
    SET name_ko = '오 프르미에르'
    WHERE perfume_id = 23
      AND fragrantica_id = 1360;
END $$;
