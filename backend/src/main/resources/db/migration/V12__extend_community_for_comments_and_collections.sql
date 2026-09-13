-- 커뮤니티 표를 댓글과 컬렉션 첨부에 맞게 넓힙니다.
--
-- 네 가지를 한 파일에 담습니다. 한 브랜치에서 나가는 변경이라 번호도 하나만 씁니다. 팀에서 같은
-- 번호를 두고 두 번 부딪힌 적이 있어(V8, V10), 한 MR 이 한 버전만 차지하도록 맞췄습니다.


-- 1. 댓글을 하드 삭제로 되돌립니다.
--
-- V4 가 서재에서, V5 가 후기·게시글의 보류 상태에서 같은 개념을 걷어내며 "존재하거나 삭제되거나
-- 둘 중 하나이고 그 사이 상태가 없다" 고 정했습니다. 댓글만 예외를 두지 않기로 했습니다.
--
-- 컬럼을 지우면 조회하는 쪽이 매번 살아 있는 행을 걸러야 하는 부담도 함께 사라집니다. 그 조건을
-- 한 곳이라도 빠뜨리면 지운 댓글이 화면에 다시 나오는데, 그 위험 자체가 없어집니다.
ALTER TABLE comments
    DROP COLUMN deleted_at;


-- 2. 댓글이 후기에도 달립니다.
--
-- 후기 게시판에 뜨는 글이 곧 후기(perfume_reviews)로 정해지면서, 그 글에 달리는 댓글을 저장할
-- 자리가 필요해졌습니다. comments 는 post_id 하나만 갖고 있어 자유 게시판 글에만 달 수 있습니다.
--
-- 표를 새로 만들지 않고 컬럼을 더합니다. 댓글의 내용·작성자·수정·삭제 규칙이 양쪽에서 똑같아서,
-- comments 와 review_comments 로 나누면 같은 코드와 같은 SQL 을 두 벌 갖게 됩니다.
--
-- CHECK 제약이 "둘 중 정확히 하나" 를 강제합니다. 애플리케이션 검사만 두면 동시 요청이나 다른
-- 경로의 삽입에 뚫립니다. 양쪽이 다 비어 있거나 다 차 있는 댓글은 어느 화면에도 나타나지 못하는
-- 유령 행이 되고, 나중에 원인을 찾기 어렵습니다.
--
-- 후기를 지우면 댓글도 함께 사라집니다. 게시글 쪽과 같은 규칙입니다.
ALTER TABLE comments
    ADD COLUMN review_id BIGINT,
    ADD CONSTRAINT fk_comments_review
        FOREIGN KEY (review_id) REFERENCES perfume_reviews (id) ON DELETE CASCADE,
    ADD CONSTRAINT ck_comments_target CHECK (
        (post_id IS NOT NULL AND review_id IS NULL)
        OR (post_id IS NULL AND review_id IS NOT NULL)
    );


-- 3. 댓글 조회 인덱스입니다.
--
-- comments 에는 인덱스가 하나도 없어서 목록 조회가 매번 전체 스캔이었습니다. 게시글 목록이 세는
-- 댓글 수도 같은 인덱스를 씁니다.
--
-- 정렬 컬럼까지 담은 이유는 목록이 오래된 순으로 나가기 때문입니다. 부모와 정렬 순서가 한 인덱스에
-- 들어 있으면 정렬을 위해 따로 줄 세울 필요가 없습니다.
CREATE INDEX idx_comments_post ON comments (post_id, created_at, comment_id);

CREATE INDEX idx_comments_review ON comments (review_id, created_at, comment_id);


-- 4. 컬렉션 공유 글에 컬렉션을 첨부합니다.
--
-- 와이어프레임의 글쓰기 화면은 분류가 "컬렉션 공유" 일 때 컬렉션을 고르는 자리를 띄우고, 글 상세는
-- 첨부된 컬렉션 이름을 보여줍니다. 그런데 posts 와 collections 를 잇는 자리가 없어 분류만 고를 수
-- 있고 정작 컬렉션은 붙일 수 없었습니다.
--
-- 글 하나에 컬렉션 하나입니다. 화면이 이름 한 줄을 보여주고 여러 개를 고르는 자리가 없어 연결 표를
-- 따로 두지 않습니다. 향수는 여러 개를 걸 수 있어 post_perfumes 라는 표가 따로 있는 것과 다릅니다.
--
-- 컬렉션을 지워도 글은 남습니다. 컬렉션을 정리했다고 그것을 소개한 글까지 사라지면 안 됩니다.
-- 첨부만 떨어집니다.
ALTER TABLE posts
    ADD COLUMN collection_id BIGINT,
    ADD CONSTRAINT fk_posts_collection
        FOREIGN KEY (collection_id) REFERENCES collections (collection_id) ON DELETE SET NULL;


-- 5. 게시글 목록 인덱스입니다.
--
-- posts 에도 인덱스가 하나도 없어서 목록 조회가 전체 스캔이었습니다. 여기에 정렬까지 붙으니 매번
-- 전부 읽고 전부 줄 세우고 있었습니다.
--
-- 두 개를 만드는 이유는 목록이 두 모양으로 나가기 때문입니다. 분류를 고르면 그 분류 안에서 최신순,
-- 고르지 않으면 전체에서 최신순입니다. 앞의 인덱스는 분류가 선두라 전체 목록에는 쓰이지 못합니다.
--
-- 정렬 방향까지 인덱스에 적습니다. 목록이 created_at DESC, post_id DESC 로 나가는데 방향이 같아야
-- 인덱스를 그대로 훑을 수 있습니다.
--
-- 댓글 많은 순 정렬은 인덱스로 받을 수 없습니다. 세어 봐야 나오는 값이라 매번 계산합니다.
CREATE INDEX idx_posts_recent
    ON posts (created_at DESC, post_id DESC);

CREATE INDEX idx_posts_category_recent
    ON posts (category_id, created_at DESC, post_id DESC);
