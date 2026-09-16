package com.hyanghae.backend.review.dto.response;

import java.time.Instant;
import java.util.List;

/**
 * 후기 상세입니다. 로그인하지 않아도 볼 수 있습니다.
 *
 * <p>{@code mine} 은 수정·삭제 버튼을 띄울지 정하는 값이라 글쓴이에게만 참입니다. 버튼을 숨기는
 * 것으로 권한이 지켜지지는 않으므로 수정·삭제 API 가 작성자를 다시 확인합니다.
 *
 * <p>{@code liked} 도 보는 사람마다 다릅니다. 비로그인에게는 항상 거짓입니다.
 *
 * <p>{@code viewCount} 는 <b>이번 조회를 포함한</b> 수입니다. 상세를 열 때 올리고 올린 값을
 * 보냅니다. 열었는데 숫자가 그대로면 올라가지 않은 것처럼 보이기 때문입니다.
 *
 * <p>{@code seasons} 는 작성자가 고른 계절입니다. 고르지 않았으면 빈 배열입니다.
 *
 * <p>댓글 수가 없습니다. 후기에는 댓글을 달지 않습니다(와이어프레임 A22a).
 */
public record ReviewDetailResponse(
        Long reviewId,
        String title,
        String content,
        String nickname,
        ReviewPerfumeResponse perfume,
        List<ReviewSeasonResponse> seasons,
        long likeCount,
        long viewCount,
        boolean liked,
        boolean mine,
        Instant createdAt,
        Instant updatedAt
) {
}
