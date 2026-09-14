package com.hyanghae.backend.community.entity;

import com.hyanghae.backend.collection.entity.Collection;
import com.hyanghae.backend.perfume.entity.Perfume;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * {@code posts} 테이블 매핑입니다. <b>자유 게시판 글</b>입니다.
 *
 * <p>후기는 {@code perfume_reviews} 에 있고 {@code review} 도메인이 담당합니다. 후기 게시판
 * 화면도 후기 쪽 자료를 보여줍니다. 여기 담기는 것은 컬렉션 공유·추천·잡담 세 분류의 글뿐입니다.
 *
 * <p>{@code userId} 를 연관이 아니라 번호로 둡니다. 사용자 엔티티가 아직 없기 때문입니다. 회원이
 * 탈퇴하면 {@code ON DELETE SET NULL} 로 비워지고 글은 남습니다. 그러면 주인이 없어 아무도 고칠
 * 수 없습니다.
 *
 * <p>이미지와 향수는 글에 딸린 값이라 글이 함께 관리합니다. 글을 지우면 따라 지워지고, 목록을
 * 통째로 바꾸면 빠진 것이 사라집니다({@code orphanRemoval}).
 *
 * <p>시각은 애플리케이션이 만듭니다. 컬렉션·후기·조회 기록과 같은 방식입니다.
 */
@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private PostCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collection_id")
    private Collection collection;

    @Column(name = "title", length = 50)
    private String title;

    @Column(name = "content")
    private String content;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /**
     * 조회수입니다. 올리는 것은 이 엔티티가 아니라 저장소의 {@code UPDATE} 문장입니다.
     *
     * <p>읽어서 더하고 저장하면 두 사람이 동시에 열 때 한 번이 사라집니다. 여기서는 값을 읽기만
     * 하고, 더하는 일은 표에게 맡깁니다.
     */
    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<PostImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private final List<PostPerfume> postPerfumes = new ArrayList<>();

    protected Post() {
        // JPA 가 요구하는 기본 생성자입니다.
    }

    /**
     * 글을 만듭니다.
     *
     * <p>{@code updatedAt} 을 만들 때부터 채웁니다. 비워 두면 화면이 "고친 적 없음" 을 따로
     * 다뤄야 합니다. 채워 두면 두 값이 같은지만 비교하면 됩니다.
     */
    public static Post create(
            Long userId,
            PostCategory category,
            String title,
            String content,
            Collection collection,
            OffsetDateTime createdAt
    ) {
        Post post = new Post();
        post.userId = userId;
        post.category = category;
        post.collection = collection;
        post.title = title;
        post.content = content;
        post.createdAt = createdAt;
        post.updatedAt = createdAt;
        return post;
    }

    /** 보낸 항목만 바꿉니다. 판단은 서비스가 하고 여기는 받은 값을 씁니다. */
    public void update(
            PostCategory category,
            String title,
            String content,
            OffsetDateTime updatedAt
    ) {
        this.category = category;
        this.title = title;
        this.content = content;
        this.updatedAt = updatedAt;
    }

    /**
     * 이미지를 통째로 바꿉니다. 화면이 목록 전체를 보내므로 비우고 다시 담습니다.
     *
     * <p>비운 뒤 바로 담으면 안 되는 경우가 있어 {@link #clearPerfumes()} 와 나눠 두었습니다.
     * 이미지는 번호가 자동 증가라 겹칠 일이 없지만, 두 목록의 사용법을 같게 두는 편이 읽힙니다.
     */
    public void replaceImages(List<String> imageUrls) {
        images.clear();
        for (int order = 0; order < imageUrls.size(); order++) {
            images.add(PostImage.create(this, imageUrls.get(order), order));
        }
    }

    /**
     * 향수 연결을 비웁니다.
     *
     * <p><b>담기 전에 반드시 먼저 내보내야 합니다.</b> {@code post_perfumes} 의 기본키가
     * (글, 향수)인데, Hibernate 는 한 번의 flush 에서 INSERT 를 DELETE 보다 먼저 내보냅니다.
     * 같은 향수를 그대로 두는 수정이라면 지우기 전에 넣으려다 기본키 충돌로 실패합니다. 서비스가
     * 이 메서드 뒤에 flush 를 한 번 끼워 순서를 확정합니다.
     */
    public void clearPerfumes() {
        postPerfumes.clear();
    }

    /** 향수를 보낸 순서대로 담습니다. {@link #clearPerfumes()} 를 먼저 부르고 씁니다. */
    public void addPerfumes(List<Perfume> perfumes) {
        for (int order = 0; order < perfumes.size(); order++) {
            postPerfumes.add(PostPerfume.create(this, perfumes.get(order), order));
        }
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    /** 첨부한 컬렉션입니다. 없을 수 있고, 컬렉션이 지워지면 비워집니다. */
    public Collection getCollection() {
        return collection;
    }

    /** 첨부를 바꾸거나 뗍니다. {@code null} 이면 떼는 것입니다. */
    public void attachCollection(Collection collection) {
        this.collection = collection;
    }

    public PostCategory getCategory() {
        return category;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public long getViewCount() {
        return viewCount;
    }
}
