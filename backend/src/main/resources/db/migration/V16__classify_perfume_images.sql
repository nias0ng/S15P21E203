-- 향수 이미지의 용도를 구분합니다.
--
-- 기존 perfume_images 는 URL 과 표시 순서만 있어 일반 이미지와 진열대용 종이 질감 이미지를
-- 구분할 수 없습니다. 기존 행과 컬럼을 생략한 INSERT 는 일반 이미지로 취급합니다.
ALTER TABLE perfume_images
    ADD COLUMN image_type VARCHAR(30) NOT NULL DEFAULT 'ORIGINAL';

ALTER TABLE perfume_images
    ADD CONSTRAINT ck_perfume_images_type
        CHECK (image_type IN ('ORIGINAL', 'PAPER_TEXTURE'));
