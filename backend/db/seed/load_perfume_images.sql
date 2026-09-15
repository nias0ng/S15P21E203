-- 향 지도 향수 200개 중 이미지가 준비된 156개에 일반·종이 질감 이미지 312개를 적재합니다.
--
-- 실행 (이 디렉터리에서):
--     ./load_perfume_images.sh
--
-- Flyway V16과 향 지도 데이터 적재가 먼저 끝나 있어야 합니다. CSV의 향 지도 순위는 로컬
-- 파일명을 검증하는 용도이며, DB 연결은 환경마다 달라질 수 있는 perfume_id 대신 안정적인
-- fragrantica_id 를 사용합니다.

\set ON_ERROR_STOP on
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
    image_count         bigint := (SELECT count(*) FROM stg_perfume_images);
    perfume_count       bigint := (SELECT count(DISTINCT fragrantica_id) FROM stg_perfume_images);
    invalid_required    bigint := (SELECT count(*) FROM stg_perfume_images
                                   WHERE korea_selection_rank !~ '^[1-9][0-9]*$'
                                      OR fragrantica_id !~ '^[1-9][0-9]*$'
                                      OR NULLIF(source_archive, '') IS NULL
                                      OR NULLIF(source_filename, '') IS NULL
                                      OR NULLIF(object_key, '') IS NULL
                                      OR NULLIF(image_url, '') IS NULL);
    invalid_type_order  bigint := (SELECT count(*) FROM stg_perfume_images
                                   WHERE (image_type = 'ORIGINAL' AND display_order <> '1')
                                      OR (image_type = 'PAPER_TEXTURE' AND display_order <> '2')
                                      OR image_type NOT IN ('ORIGINAL', 'PAPER_TEXTURE'));
    invalid_pairs       bigint := (SELECT count(*) FROM (
                                       SELECT fragrantica_id
                                       FROM stg_perfume_images
                                       GROUP BY fragrantica_id
                                       HAVING count(*) <> 2
                                          OR count(DISTINCT image_type) <> 2
                                   ) invalid);
    duplicate_keys      bigint := (SELECT count(*) FROM (
                                       SELECT object_key FROM stg_perfume_images
                                       GROUP BY object_key HAVING count(*) > 1
                                   ) duplicated);
    invalid_paths       bigint := (SELECT count(*) FROM stg_perfume_images
                                   WHERE object_key <> 'perfumes/' || fragrantica_id || '/'
                                           || CASE image_type
                                                  WHEN 'ORIGINAL' THEN 'original.png'
                                                  WHEN 'PAPER_TEXTURE' THEN 'paper-texture.png'
                                              END
                                      OR image_url <> 'https://djpgc0m2v54q1.cloudfront.net/' || object_key);
BEGIN
    IF image_count <> 312 OR perfume_count <> 156 THEN
        RAISE EXCEPTION '향수 이미지 수가 다릅니다: 기대 312행/156향수, 실제 %행/%향수',
            image_count, perfume_count;
    END IF;
    IF invalid_required <> 0 THEN
        RAISE EXCEPTION '필수값이 비었거나 번호 형식이 잘못된 이미지가 %개입니다', invalid_required;
    END IF;
    IF invalid_type_order <> 0 THEN
        RAISE EXCEPTION '이미지 타입과 표시 순서가 어긋난 행이 %개입니다', invalid_type_order;
    END IF;
    IF invalid_pairs <> 0 THEN
        RAISE EXCEPTION '일반·종이 질감 이미지 한 쌍이 완전하지 않은 향수가 %개입니다', invalid_pairs;
    END IF;
    IF duplicate_keys <> 0 THEN
        RAISE EXCEPTION '중복 S3 객체 키가 %개입니다', duplicate_keys;
    END IF;
    IF invalid_paths <> 0 THEN
        RAISE EXCEPTION 'S3 객체 키 또는 CloudFront URL 규칙이 잘못된 행이 %개입니다', invalid_paths;
    END IF;
END $$;

-- 향 지도 200개가 먼저 적재됐는지, 순위와 fragrantica_id가 같은 향수를 가리키는지 확인합니다.
CREATE TEMP TABLE loaded_perfumes ON COMMIT DROP AS
SELECT DISTINCT p.perfume_id, p.fragrantica_id
FROM perfumes p
JOIN stg_perfume_images s ON s.fragrantica_id::bigint = p.fragrantica_id
                         AND s.korea_selection_rank::int = p.korea_selection_rank;

CREATE UNIQUE INDEX ON loaded_perfumes (perfume_id);
CREATE UNIQUE INDEX ON loaded_perfumes (fragrantica_id);

DO $$
DECLARE
    loaded_count bigint := (SELECT count(*) FROM loaded_perfumes);
BEGIN
    IF loaded_count <> 156 THEN
        RAISE EXCEPTION '향 지도 향수와 연결된 이미지 향수가 모자랍니다: 기대 156, 실제 %', loaded_count;
    END IF;
END $$;

-- 이 전달본이 담당하는 두 타입만 교체합니다. 이미지가 없는 나머지 44개 향수와 범위 밖 향수의
-- 기존 이미지는 건드리지 않습니다. 삭제와 삽입은 같은 트랜잭션이라 중간 실패 시 함께 되돌아갑니다.
DELETE FROM perfume_images i
USING loaded_perfumes l
WHERE i.perfume_id = l.perfume_id
  AND i.image_type IN ('ORIGINAL', 'PAPER_TEXTURE');

INSERT INTO perfume_images (perfume_id, image_url, image_type, display_order)
SELECT l.perfume_id,
       s.image_url,
       s.image_type,
       s.display_order::integer
FROM stg_perfume_images s
JOIN loaded_perfumes l ON l.fragrantica_id = s.fragrantica_id::bigint;

DO $$
DECLARE
    loaded_images bigint := (SELECT count(*)
                             FROM perfume_images i
                             JOIN loaded_perfumes l ON l.perfume_id = i.perfume_id
                             WHERE i.image_type IN ('ORIGINAL', 'PAPER_TEXTURE'));
BEGIN
    IF loaded_images <> 312 THEN
        RAISE EXCEPTION '적재된 향수 이미지가 모자랍니다: 기대 312, 실제 %', loaded_images;
    END IF;
END $$;

SELECT count(DISTINCT l.perfume_id) AS perfumes_with_images,
       count(*) FILTER (WHERE i.image_type = 'ORIGINAL') AS original_images,
       count(*) FILTER (WHERE i.image_type = 'PAPER_TEXTURE') AS paper_texture_images
FROM loaded_perfumes l
JOIN perfume_images i ON i.perfume_id = l.perfume_id;

COMMIT;

ANALYZE perfume_images;
