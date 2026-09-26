-- S15P21E203-441: check_brand_logos_441.sql 결과를 백업하고 CloudFront URL을 확인한 뒤 실행합니다.
\set ON_ERROR_STOP on
-- 브랜드 로고 9개를 새 WebP 로 바꿉니다 (2026-09-24).
-- brands 폴더를 S3 에 올린 뒤 실행하세요. 이름이 하나라도 안 맞아 9행이 아니면
-- 예외를 내고 아무것도 바꾸지 않습니다.
DO $$
DECLARE
    changed integer;
BEGIN
    UPDATE brands AS b
    SET logo_url = v.logo_url
    FROM (VALUES
        ('#Parfum Hashtag', 'https://djpgc0m2v54q1.cloudfront.net/brands/parfum-hashtag.webp'),
        ('100% Perfumes', 'https://djpgc0m2v54q1.cloudfront.net/brands/100-perfumes.webp'),
        ('109 Parfums', 'https://djpgc0m2v54q1.cloudfront.net/brands/109-parfums.webp'),
        ('13th Floor Fragrance', 'https://djpgc0m2v54q1.cloudfront.net/brands/13th-floor-fragrance.webp'),
        ('18.21 Man Made', 'https://djpgc0m2v54q1.cloudfront.net/brands/18-21-man-made.webp'),
        ('1918 Parfum National', 'https://djpgc0m2v54q1.cloudfront.net/brands/1918-parfum-national.webp'),
        ('2impress', 'https://djpgc0m2v54q1.cloudfront.net/brands/2impress.webp'),
        ('401 È Amatrice', 'https://djpgc0m2v54q1.cloudfront.net/brands/401-e-amatrice.webp'),
        ('Новая Заря (The New Dawn)', 'https://djpgc0m2v54q1.cloudfront.net/brands/the-new-dawn.webp')
    ) AS v(name, logo_url)
    WHERE b.name = v.name;

    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 9 THEN
        RAISE EXCEPTION '%행이 바뀌어야 하는데 %행입니다. 아무것도 바꾸지 않았습니다.', 9, changed;
    END IF;
END $$;
