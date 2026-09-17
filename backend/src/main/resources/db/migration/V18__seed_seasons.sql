-- 후기가 고르는 계절입니다.
--
-- 후기를 쓰려면 계절을 1개 이상 4개 이하로 골라야 하는데(ReviewCreateRequest 의 @NotEmpty),
-- 표가 비어 있어 **어떤 값을 보내도 REVIEW_SEASON_NOT_FOUND 입니다.** 즉 지금 배포된 곳에서는
-- 후기를 한 건도 쓸 수 없습니다. 지금까지 드러나지 않은 이유는 화면이 아직 후기 작성을 붙이지
-- 않았고, 테스트가 계절을 직접 넣고 돌기 때문입니다.
--
-- 시드가 아니라 마이그레이션으로 넣습니다. 계절 넷이 존재한다는 것은 기능의 일부라 어느
-- 환경에서나 같아야 하고, 시드를 돌리지 않은 곳(CI 포함)에서는 후기 작성이 통째로 막힙니다.
-- 자유 게시판 분류를 V11 이, 향 계열 9개를 V5 가 같은 이유로 심었습니다.
--
-- 번호를 적지 않습니다. season_id 는 IDENTITY 라 환경마다 다른 값이 붙을 수 있고, 그래도
-- 상관없습니다 — 화면과 API 가 주고받는 것은 code 입니다. 번호에 기대는 것은 이 표를 참조하는
-- perfume_review_seasons 뿐이고 그것은 같은 데이터베이스 안의 일입니다.
--
-- code 는 화면이 쓰는 값이고 name 은 사람이 읽는 이름입니다.
INSERT INTO seasons (code, name, is_active) VALUES
    ('SPRING', '봄',   TRUE),
    ('SUMMER', '여름', TRUE),
    ('AUTUMN', '가을', TRUE),
    ('WINTER', '겨울', TRUE);

-- 같은 코드가 둘이면 코드로 찾을 때 어느 쪽인지 정할 수 없습니다. 후기가 코드로 계절을 고르므로
-- 표가 막아야 합니다. post_categories 에는 이 제약이 없는데, 그쪽은 분류를 코드로 찾는 경로가
-- 아직 없어서입니다.
ALTER TABLE seasons
    ADD CONSTRAINT uk_seasons_code UNIQUE (code);
