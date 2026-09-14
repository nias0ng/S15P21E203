package com.hyanghae.backend.community.repository;

import com.hyanghae.backend.community.entity.PostLike;
import com.hyanghae.backend.community.entity.PostLikeId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * 글 좋아요를 읽고 씁니다.
 *
 * <p><b>누르기만 네이티브 쿼리입니다.</b> 좋아요는 여러 번 눌러도 결과가 같아야 하는데, 먼저
 * 확인하고 없으면 넣는 식으로 쓰면 두 요청이 동시에 들어올 때 둘 다 "없음" 을 보고 둘 다 넣으려
 * 합니다. 그러면 한쪽이 기본키 충돌로 500 을 받습니다. PostgreSQL 의 {@code ON CONFLICT DO
 * NOTHING} 은 이 확인과 삽입을 한 문장으로 처리해 그 틈이 없습니다.
 *
 * <p>나머지는 JPA 가 합니다.
 */
@Repository
public interface PostLikeRepository extends JpaRepository<PostLike, PostLikeId> {

    /**
     * 좋아요를 누릅니다. 이미 눌러 두었으면 아무 일도 일어나지 않습니다.
     *
     * @return 실제로 들어간 행 수. 처음 누르면 1, 이미 눌러 두었으면 0
     */
    @Modifying
    @Query(value = """
            INSERT INTO post_likes (post_id, user_id, created_at)
            VALUES (:postId, :userId, NOW())
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int like(@Param("postId") Long postId, @Param("userId") Long userId);

    /** 좋아요를 취소합니다. 누르지 않았으면 아무 일도 일어나지 않습니다. */
    @Modifying
    @Query("""
            DELETE FROM PostLike l
            WHERE l.id.postId = :postId AND l.id.userId = :userId
            """)
    int unlike(@Param("postId") Long postId, @Param("userId") Long userId);

    @Query("SELECT COUNT(l) FROM PostLike l WHERE l.id.postId = :postId")
    long countOfPost(@Param("postId") Long postId);

    @Query("""
            SELECT COUNT(l) > 0
            FROM PostLike l
            WHERE l.id.postId = :postId AND l.id.userId = :userId
            """)
    boolean isLikedBy(@Param("postId") Long postId, @Param("userId") Long userId);

    /**
     * 이 글들 중 내가 누른 것입니다.
     *
     * <p>목록의 글마다 따로 물으면 한 페이지에 쿼리가 스무 번 나갑니다. 번호를 모아 한 번에
     * 읽습니다. 기본키가 글 번호로 시작해 표를 보지 않고 색인만으로 끝납니다.
     */
    @Query("""
            SELECT l.id.postId
            FROM PostLike l
            WHERE l.id.userId = :userId AND l.id.postId IN :postIds
            """)
    List<Long> findLikedPostIds(
            @Param("userId") Long userId,
            @Param("postIds") Collection<Long> postIds
    );
}
