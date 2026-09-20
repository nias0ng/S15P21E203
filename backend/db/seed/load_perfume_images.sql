-- 전체 WebP 일반 이미지와 준비된 종이 질감 이미지를 적재합니다.
--
-- 실행 (backend/db/seed 디렉터리에서):
--     ./load_perfume_images.sh
--
-- DB 연결은 환경마다 달라질 수 있는 perfume_id 대신 안정적인
-- fragrantica_id를 사용합니다. 향수 카탈로그 적재가 먼저 끝나 있어야 합니다.

\set ON_ERROR_STOP on
\pset pager off
\timing on

BEGIN;

CREATE TEMP TABLE stg_perfume_images (
    korea_selection_rank TEXT,
    fragrantica_id       TEXT,
    image_type           TEXT,
    display_order        TEXT,
    source_archive       TEXT,
    source_filename      TEXT,
    object_key           TEXT,
    image_url            TEXT
) ON COMMIT DROP;

\copy stg_perfume_images FROM 'perfume_images.csv' WITH (FORMAT csv, HEADER true)

-- CSV 자체와 S3·CDN 경로 규칙을 DB 변경 전에 검증합니다.
DO $$
DECLARE
    invalid_required bigint := (
        SELECT count(*)
        FROM stg_perfume_images
        WHERE fragrantica_id !~ '^[1-9][0-9]*$'
           OR (NULLIF(korea_selection_rank, '') IS NOT NULL
               AND korea_selection_rank !~ '^[1-9][0-9]*$')
           OR NULLIF(source_archive, '') IS NULL
           OR NULLIF(source_filename, '') IS NULL
           OR NULLIF(object_key, '') IS NULL
           OR NULLIF(image_url, '') IS NULL
    );
    invalid_type_order bigint := (
        SELECT count(*)
        FROM stg_perfume_images
        WHERE (image_type = 'ORIGINAL' AND display_order <> '1')
           OR (image_type = 'PAPER_TEXTURE' AND display_order <> '2')
           OR image_type NOT IN ('ORIGINAL', 'PAPER_TEXTURE')
    );
    duplicate_images bigint := (
        SELECT count(*)
        FROM (
            SELECT fragrantica_id, image_type
            FROM stg_perfume_images
            GROUP BY fragrantica_id, image_type
            HAVING count(*) > 1
        ) duplicated
    );
    duplicate_keys bigint := (
        SELECT count(*)
        FROM (
            SELECT object_key
            FROM stg_perfume_images
            GROUP BY object_key
            HAVING count(*) > 1
        ) duplicated
    );
    missing_original bigint := (
        SELECT count(*)
        FROM (
            SELECT fragrantica_id
            FROM stg_perfume_images
            GROUP BY fragrantica_id
            HAVING count(*) FILTER (WHERE image_type = 'ORIGINAL') <> 1
        ) invalid
    );
    invalid_paths bigint := (
        SELECT count(*)
        FROM stg_perfume_images
        WHERE object_key <> 'perfumes/' || fragrantica_id || '/'
            || CASE image_type
                   WHEN 'ORIGINAL' THEN 'original.webp'
                   WHEN 'PAPER_TEXTURE' THEN 'paper-texture.png'
               END
           OR image_url <> 'https://djpgc0m2v54q1.cloudfront.net/' || object_key
    );
BEGIN
    IF invalid_required <> 0 THEN
        RAISE EXCEPTION '필수값이 비었거나 번호 형식이 잘못된 이미지가 %개입니다', invalid_required;
    END IF;
    IF invalid_type_order <> 0 THEN
        RAISE EXCEPTION '이미지 타입과 표시 순서가 어긋난 행이 %개입니다', invalid_type_order;
    END IF;
    IF duplicate_images <> 0 THEN
        RAISE EXCEPTION '향수별 이미지 타입이 중복된 항목이 %개입니다', duplicate_images;
    END IF;
    IF duplicate_keys <> 0 THEN
        RAISE EXCEPTION '중복 S3 객체 키가 %개입니다', duplicate_keys;
    END IF;
    IF missing_original <> 0 THEN
        RAISE EXCEPTION '일반 이미지가 정확히 한 장이 아닌 향수가 %개입니다', missing_original;
    END IF;
    IF invalid_paths <> 0 THEN
        RAISE EXCEPTION 'S3 객체 키 또는 CloudFront URL 규칙이 잘못된 행이 %개입니다', invalid_paths;
    END IF;
END $$;

-- 카탈로그에 적재된 향수를 fragrantica_id로 연결합니다.
CREATE TEMP TABLE loaded_perfumes ON COMMIT DROP AS
SELECT DISTINCT p.perfume_id, p.fragrantica_id
FROM perfumes p
JOIN stg_perfume_images s ON s.fragrantica_id::bigint = p.fragrantica_id;

CREATE UNIQUE INDEX ON loaded_perfumes (perfume_id);
CREATE UNIQUE INDEX ON loaded_perfumes (fragrantica_id);

DO $$
DECLARE
    staged_count bigint := (SELECT count(DISTINCT fragrantica_id) FROM stg_perfume_images);
    loaded_count bigint := (SELECT count(*) FROM loaded_perfumes);
    rank_mismatch_count bigint := (
        SELECT count(*)
        FROM stg_perfume_images s
        JOIN perfumes p ON p.fragrantica_id = s.fragrantica_id::bigint
        WHERE NULLIF(s.korea_selection_rank, '') IS NOT NULL
          AND s.korea_selection_rank::int IS DISTINCT FROM p.korea_selection_rank
    );
BEGIN
    IF loaded_count <> staged_count THEN
        RAISE EXCEPTION '카탈로그에 없는 이미지 향수가 있습니다: CSV %향수, 연결 %향수',
            staged_count, loaded_count;
    END IF;
    IF rank_mismatch_count <> 0 THEN
        RAISE EXCEPTION '한국 선택 순위가 DB와 다른 이미지가 %개입니다', rank_mismatch_count;
    END IF;
END $$;

-- CSV가 제공하는 이미지 타입만 교체합니다. CSV에 없는 타입의 기존 이미지는 유지합니다.
DELETE FROM perfume_images i
USING loaded_perfumes l
WHERE i.perfume_id = l.perfume_id
  AND EXISTS (
      SELECT 1
      FROM stg_perfume_images s
      WHERE s.fragrantica_id::bigint = l.fragrantica_id
        AND s.image_type = i.image_type
  );

INSERT INTO perfume_images (perfume_id, image_url, image_type, display_order)
SELECT l.perfume_id,
       s.image_url,
       s.image_type,
       s.display_order::integer
FROM stg_perfume_images s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint;

DO $$
DECLARE
    staged_images bigint := (SELECT count(*) FROM stg_perfume_images);
    loaded_images bigint := (
        SELECT count(*)
        FROM perfume_images i
        JOIN loaded_perfumes l ON l.perfume_id = i.perfume_id
        JOIN stg_perfume_images s
          ON s.fragrantica_id::bigint = l.fragrantica_id
         AND s.image_type = i.image_type
    );
BEGIN
    IF loaded_images <> staged_images THEN
        RAISE EXCEPTION '적재된 향수 이미지가 모자랍니다: CSV %행, 적재 %행',
            staged_images, loaded_images;
    END IF;
END $$;

SELECT count(DISTINCT l.perfume_id) AS perfumes_with_images,
       count(*) FILTER (WHERE i.image_type = 'ORIGINAL') AS original_images,
       count(*) FILTER (WHERE i.image_type = 'PAPER_TEXTURE') AS paper_texture_images
FROM loaded_perfumes l
JOIN perfume_images i ON i.perfume_id = l.perfume_id
WHERE EXISTS (
    SELECT 1
    FROM stg_perfume_images s
    WHERE s.fragrantica_id::bigint = l.fragrantica_id
      AND s.image_type = i.image_type
);

COMMIT;

ANALYZE perfume_images;
