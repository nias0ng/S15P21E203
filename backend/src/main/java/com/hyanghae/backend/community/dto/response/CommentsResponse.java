package com.hyanghae.backend.community.dto.response;

import java.util.List;

/**
 * 댓글 목록 한 페이지입니다.
 *
 * <p>오래된 순입니다. 댓글은 대화라서 위에서 아래로 읽히고 새 댓글이 맨 아래에 붙습니다. 고친
 * 시각으로 정렬하면 오래된 댓글이 오타 하나 고칠 때마다 맨 아래로 튀어 앞뒤 맥락이 끊깁니다.
 *
 * <p>{@code totalElements} 는 이 페이지가 아니라 글 전체의 댓글 수입니다. 화면의 "댓글 12" 가
 * 이 값입니다.
 */
public record CommentsResponse(
        List<CommentResponse> comments,
        int page,
        int size,
        long totalElements
) {
}
