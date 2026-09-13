package com.hyanghae.backend.community.entity;

import com.hyanghae.backend.review.entity.PerfumeReview;
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
 * <p><b>댓글은 자유 게시판 글과 후기 두 곳에 달립니다.</b> 한 표에 담고 {@code post} 와
 * {@code review} 중 하나만 채웁니다. 내용과 작성자, 수정·삭제 규칙이 양쪽에서 똑같아 표를 나누면
 * 같은 코드를 두 벌 갖게 됩니다. "둘 중 정확히 하나" 는 V12 의 {@code CHECK} 제약이 지킵니다.
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_id")
    private PerfumeReview review;

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

    /** 후기에 다는 댓글입니다. 규칙은 글 쪽과 같고 매달리는 자리만 다릅니다. */
    public static Comment onReview(
            PerfumeReview review,
            Long userId,
            String content,
            OffsetDateTime now
    ) {
        Comment comment = new Comment();
        comment.review = review;
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
