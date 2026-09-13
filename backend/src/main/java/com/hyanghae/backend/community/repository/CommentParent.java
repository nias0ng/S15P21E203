package com.hyanghae.backend.community.repository;

/**
 * 댓글이 매달리는 대상입니다. 자유 게시판 글이거나 후기입니다.
 *
 * <p>둘을 한 표에 담기 때문에 어느 쪽인지 알려 줄 값이 필요합니다. 컬럼 이름을 문자열로 들고
 * 다니지 않고 enum 으로 두는 이유는, 문자열이면 오타가 SQL 에 그대로 실려 나가고 바깥에서 들어온
 * 값이 섞일 여지도 생기기 때문입니다. 여기 적힌 두 가지 말고는 아예 만들 수 없습니다.
 */
public enum CommentParent {

    POST,
    REVIEW
}
