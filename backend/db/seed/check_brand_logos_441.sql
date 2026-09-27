-- 업데이트 전 결과를 백업하고, 업데이트 후 같은 조회로 WebP URL 9개를 확인합니다.
SELECT brand_id, name, logo_url
FROM brands
WHERE name IN (
    '#Parfum Hashtag',
    '100% Perfumes',
    '109 Parfums',
    '13th Floor Fragrance',
    '18.21 Man Made',
    '1918 Parfum National',
    '2impress',
    '401 È Amatrice',
    'Новая Заря (The New Dawn)'
)
ORDER BY name;
