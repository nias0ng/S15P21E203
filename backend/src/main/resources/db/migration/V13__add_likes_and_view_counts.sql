-- 자유 게시판 글과 후기에 좋아요와 조회수를 붙입니다.
--
-- 와이어프레임 A22a·A22b 가 두 게시판에 "조회 순" 과 "좋아요 순" 정렬을 두고, 자유 게시판에만
-- "댓글 많은 순" 을 더 둡니다. 지금은 최신순과 댓글 순뿐이라 칩 두 개가 눌러도 아무 일이 없습니다.


-- 1. 좋아요는 누가 눌렀는지 기록합니다.
--
-- 숫자만 두면 취소를 처리할 수 없고, 한 사람이 여러 번 누르는 것도 막지 못하며, 화면이 "내가 이미
-- 눌렀는지" 를 알 수 없습니다. 세 가지가 모두 누가 눌렀는지를 알아야 풀립니다.
--
-- 기본키가 (대상, 사용자) 입니다. 같은 사람이 같은 글에 두 번 누르면 표가 거부합니다. 애플리케이션
-- 검사만 두면 두 요청이 동시에 들어올 때 둘 다 통과합니다.
--
-- 표를 둘로 나눕니다. likes (target_type, target_id) 하나로 합치면 target_id 가 두 표를 가리켜
-- 외래키를 걸 수 없습니다. 그러면 글을 지워도 좋아요가 남아, 아무 글에도 매달리지 않은 행이
-- 쌓입니다. 비슷한 코드가 두 벌 생기는 것보다 이 쪽이 낫다고 봤습니다.
--
-- 탈퇴하면 좋아요가 사라집니다. 글·후기·댓글과 다른 규칙입니다. 글은 남겨야 대화가 이어지지만,
-- 좋아요는 그 사람이 눌렀다는 사실 자체라서 사람이 없어지면 남을 이유가 없습니다. 좋아요 수도
-- 그만큼 줄어야 맞습니다.
CREATE TABLE post_likes (
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT fk_post_likes_post
        FOREIGN KEY (post_id) REFERENCES posts (post_id) ON DELETE CASCADE,
    CONSTRAINT fk_post_likes_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE review_likes (
    review_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id),
    CONSTRAINT fk_review_likes_review
        FOREIGN KEY (review_id) REFERENCES perfume_reviews (id) ON DELETE CASCADE,
    CONSTRAINT fk_review_likes_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);


-- 2. 조회수는 숫자 한 칸입니다.
--
-- 좋아요와 달리 표를 두지 않습니다. 목록과 상세는 로그인 없이 볼 수 있어서 보는 사람을 특정할 수
-- 없고, 특정할 수 없으면 기록할 것도 없습니다. user_perfume_views 가 로그인한 사람의 향수 열람만
-- 기록하는 것과 사정이 다릅니다.
--
-- 새로고침할 때마다 오릅니다. 막으려면 세션이나 IP 를 어딘가에 들고 있어야 하는데, 인증이 아직
-- 없어 지금은 둘 다 없습니다. 조회수는 정확해야 하는 값이 아니라고 보고 그대로 둡니다.
--
-- NOT NULL DEFAULT 0 입니다. 비어 있을 수 있으면 세는 쪽이 매번 빈 값을 0 으로 바꿔야 하고,
-- 정렬에서도 어디에 놓을지 따로 정해야 합니다.
ALTER TABLE posts
    ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;

ALTER TABLE perfume_reviews
    ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;


-- 3. 정렬 인덱스입니다.
--
-- 조회 순은 저장된 숫자라 인덱스로 받을 수 있습니다. 좋아요 순은 세어 봐야 나오는 값이라 받을 수
-- 없습니다. 댓글 많은 순과 같은 사정입니다.
--
-- 정렬 방향까지 인덱스에 적고 기본키를 뒤에 붙입니다. 값이 같은 행이 많아서 그것만으로는 순서가
-- 흔들리고, 흔들리면 페이지를 넘길 때 같은 글이 두 번 나오거나 어떤 글이 아예 빠집니다.
CREATE INDEX idx_posts_views
    ON posts (view_count DESC, post_id DESC);

CREATE INDEX idx_perfume_reviews_views
    ON perfume_reviews (view_count DESC, id DESC);

-- 후기 게시판이 향수를 가리지 않고 전체를 최신순으로 봅니다. V5 의 idx_perfume_reviews_perfume 은
-- 향수가 선두라 이 목록에는 쓰이지 못합니다.
CREATE INDEX idx_perfume_reviews_recent
    ON perfume_reviews (created_at DESC, id DESC);
