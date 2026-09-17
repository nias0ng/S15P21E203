package com.hyanghae.backend.community.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * {@code comments} 테이블 매핑입니다.
 *
 * <p><b>댓글은 자유 게시판 글에만 답니다.</b> 후기에는 댓글을 쓰지 않고 좋아요만 있습니다
 * (와이어프레임 A22a). 그래서 매달리는 자리가 {@code post} 하나입니다.
 *
 * <p>{@code userId} 를 연관이 아니라 번호로 둡니다. 사용자 엔티티가 아직 없기 때문입니다. 회원이
 * 탈퇴하면 {@code ON DELETE SET NULL} 로 비워지고 댓글은 남습니다. 그러면 주인이 없어 아무도
 * 고칠 수 없습니다.
 *
 * <p>지우면 행이 사라집니다. 서재(V4)와 후기·게시글의 보류 상태(V5)에서 걷어낸 것과 같은 기준으로,
 * 댓글도 존재하거나 삭제되거나 둘 중 하나입니다.
 */
@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private Post post;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "content")
    private String content;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected Comment() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    /**
     * 자유 게시판 글에 다는 댓글입니다.
     *
     * <p>{@code updatedAt} 을 만들 때부터 채웁니다. 비워 두면 화면이 "고친 적 없음" 을 따로
     * 다뤄야 합니다. 채워 두면 두 값이 같은지만 비교하면 됩니다.
     */
    public static Comment onPost(Post post, Long userId, String content, OffsetDateTime now) {
        Comment comment = new Comment();
        comment.post = post;
        comment.userId = userId;
        comment.content = content;
        comment.createdAt = now;
        comment.updatedAt = now;
        return comment;
    }

    public void update(String content, OffsetDateTime updatedAt) {
        this.content = content;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
