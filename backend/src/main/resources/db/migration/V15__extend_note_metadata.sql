-- 노트 카드와 탐색 화면에 필요한 표시 정보를 더합니다.
--
-- 기존 notes.name 은 영문 원본명이며 V5 의 uk_notes_name 제약으로 유일합니다. 전달받은 CSV도
-- 같은 영문명을 사용하므로 note_id 를 외부에서 정하지 않고 name 으로 기존 행을 찾아 갱신합니다.
-- note_id 는 데이터베이스가 계속 생성하며 popularity_rank 와는 관계가 없습니다.


-- 1. 한국어 표시 이름입니다.
--
-- 기존 노트와 새로 들어올 수 있는 비수집 노트가 있어 우선 NULL 을 허용합니다. 246개 전달 데이터의
-- 적재가 끝난 뒤에도 범위 밖 노트는 번역이 없을 수 있으므로 전체 테이블에 NOT NULL 을 걸지 않습니다.
ALTER TABLE notes
    ADD COLUMN name_ko VARCHAR(100);


-- 2. 노트의 대표 어코드 분류입니다.
--
-- 전달 파일은 CITRUS, WOODY, FLORAL 같은 문자열 코드를 줍니다. 기존 accords 및 scent_regions 와
-- 분류 단위가 같지 않으므로 잘못된 외래 키로 묶지 않고 원본 코드를 그대로 보관합니다.
ALTER TABLE notes
    ADD COLUMN accord_family VARCHAR(30);


-- 3. CloudFront 로 제공할 노트 이미지 주소입니다.
--
-- S3 객체 자체가 아니라 브라우저가 읽을 공개 CDN 주소를 저장합니다. 아직 이미지가 없는 노트도
-- 서비스할 수 있도록 NULL 을 허용하며, 화면은 NULL 일 때 자리표시자를 사용합니다.
ALTER TABLE notes
    ADD COLUMN image_url TEXT;


-- 4. 원본 데이터에서 계산한 노트 언급량 순위입니다.
--
-- note_id 는 관계를 식별하는 내부 키이고 이 값은 화면 정렬용 통계라 별도 컬럼에 둡니다. 현재
-- 전달 범위 밖 노트는 순위가 없으므로 NULL 을 허용하고, 값이 있다면 1 이상의 순위만 받습니다.
ALTER TABLE notes
    ADD COLUMN popularity_rank INTEGER;

ALTER TABLE notes
    ADD CONSTRAINT ck_notes_popularity_rank_positive
        CHECK (popularity_rank IS NULL OR popularity_rank > 0);
