package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.entity.Comment;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 댓글을 읽고 씁니다.
 *
 * <p>쓰기와 단건 조회는 JPA 가 합니다. 내용 수정은 {@link Comment} 의 필드를 바꾸면 트랜잭션이
 * 끝날 때 반영되므로 문장을 따로 쓰지 않습니다.
 *
 * <p><b>목록과 개수만 네이티브 쿼리입니다.</b> 작성자 닉네임이 필요한데 사용자 엔티티가 없어
 * JPQL 로 {@code users} 를 조인할 수 없습니다. 게시글 목록과 같은 사정입니다.
 */
@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    String SELECT_COLUMNS = """
            SELECT c.comment_id AS commentId, c.user_id AS authorId, u.nickname AS nickname,
                   c.content AS content, c.created_at AS createdAt, c.updated_at AS updatedAt
            FROM comments c
            LEFT JOIN users u ON u.user_id = c.user_id
            """;

    /**
     * 목록과 개수가 같은 범위를 보도록 조건을 따로 묶었습니다. 한쪽만 고치면 "댓글 12" 라고 써
     * 놓고 11개만 보여주는 일이 생깁니다.
     */
    String OF_POST = """
            WHERE c.post_id = :postId
            """;

    /**
     * <b>오래된 순</b>입니다. 댓글은 대화라서 위에서 아래로 읽히고 새 댓글이 맨 아래에 붙습니다.
     *
     * <p>시각이 같거나 비어 있어도 순서가 흔들리지 않도록 {@code comment_id} 로 순서를 확정합니다.
     * 순서가 흔들리면 페이지를 넘길 때 같은 댓글이 두 번 나오거나 어떤 댓글이 아예 안 보입니다.
     */
    String ORDER_AND_PAGE = """
            ORDER BY c.created_at NULLS LAST, c.comment_id
            LIMIT :limit OFFSET :offset
            """;

    @Query(value = SELECT_COLUMNS + OF_POST + ORDER_AND_PAGE, nativeQuery = true)
    List<CommentRow> findPageOfPost(
            @Param("postId") Long postId,
            @Param("limit") int limit,
            @Param("offset") long offset
    );

    @Query(value = "SELECT COUNT(*) FROM comments c " + OF_POST, nativeQuery = true)
    long countOfPost(@Param("postId") Long postId);

    /**
     * 고치거나 지우기 전에 잠그고 읽습니다.
     *
     * <p>잠그지 않으면 주인을 확인한 뒤 실제로 고치는 사이에 다른 요청이 같은 댓글을 지울 수
     * 있습니다. 사용자가 탭 두 개를 열어 두면 실제로 일어납니다. 후기·조회 기록도 같은 방식으로
     * 막고 있습니다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT c
            FROM Comment c
            WHERE c.id = :commentId
            """)
    Optional<Comment> findForUpdate(@Param("commentId") Long commentId);
}
