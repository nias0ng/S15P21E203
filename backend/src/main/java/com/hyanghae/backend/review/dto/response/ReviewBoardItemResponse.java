package com.hyanghae.backend.review.dto.response;

import java.time.Instant;

/**
 * 후기 게시판에 한 줄로 나오는 후기입니다.
 *
 * <p>자유 게시판의 한 줄과 달리 분류와 댓글 수가 없습니다. 후기는 전부 같은 종류라 분류가 없고
 * (와이어프레임 A22a — "분류 필터는 없다"), 후기에는 댓글을 달지 않습니다.
 *
 * <p>{@code liked} 는 보는 사람마다 다릅니다. 하트를 칠할지 정하는 값이라 내가 누른 후기에만
 * 참이고, 비로그인에게는 항상 거짓입니다. {@code likeCount} 는 누구에게나 같습니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 후기는 남고 작성자만 지워집니다
 * ({@code perfume_reviews.user_id} 가 {@code ON DELETE SET NULL} 입니다).
 */
public record ReviewBoardItemResponse(
        Long reviewId,
        String title,
        String content,
        String nickname,
        ReviewPerfumeResponse perfume,
        long likeCount,
        long viewCount,
        boolean liked,
        Instant createdAt
) {
}
