package com.hyanghae.backend.community.repository;

/**
 * 게시글 목록 정렬 기준입니다. 자유 게시판의 정렬 칩 네 개와 하나씩 맞습니다.
 *
 * <p>문자열이 아니라 enum 인 이유는 정렬 문장을 미리 써 두고 고르기 위해서입니다. 요청 값을 SQL 에
 * 이어 붙이면 그대로 뚫립니다. 목록에 없는 값이 오면 Spring 이 400 으로 돌려줍니다.
 *
 * <p>후기 게시판에는 {@code COMMENTS} 가 없습니다. 후기에는 댓글을 달지 않기 때문입니다
 * (와이어프레임 A22a). 그래서 후기 쪽은 {@code ReviewSort} 를 따로 둡니다.
 */
public enum PostSort {

    /** 최신순입니다. 기본값입니다. */
    RECENT,

    /** 조회가 많은 순입니다. 같으면 최신순으로 갈립니다. */
    VIEWS,

    /** 좋아요가 많은 순입니다. 같으면 최신순으로 갈립니다. */
    LIKES,

    /** 댓글이 많은 순입니다. 같으면 최신순으로 갈립니다. */
    COMMENTS
}
