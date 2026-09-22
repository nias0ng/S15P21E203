package com.hyanghae.backend.community.repository;

import java.time.Instant;

/**
 * 목록 한 줄입니다.
 *
 * <p>인터페이스인 이유가 있습니다. 이 줄은 네이티브 쿼리가 채우는데, 네이티브 결과는 레코드
 * 생성자로 바로 받을 수 없고 인터페이스 프로젝션으로만 받을 수 있습니다.
 *
 * <p>시각이 {@link Instant} 인 이유도 같습니다. 네이티브 결과의 {@code timestamptz} 를 Hibernate
 * 가 {@link Instant} 로 읽어 주는데, 프로젝션이 다른 시간 타입을 요구하면 변환하지 못하고
 * 실패합니다. 서비스가 응답을 만들 때 시간대를 붙입니다.
 *
 * <p>{@code authorId} 는 응답에 그대로 나가지 않습니다. {@code mine} 을 채우는 데만 씁니다.
 * 작성자가 탈퇴하면 비어 있고 그런 댓글은 누구에게도 자기 것이 아닙니다.
 */
public interface CommentRow {

    Long getCommentId();

    Long getAuthorId();

    String getNickname();

    /** 작성자가 탈퇴했거나 사진을 설정하지 않았으면 비어 있습니다. */
    String getProfileImageUrl();

    String getContent();

    Instant getCreatedAt();

    Instant getUpdatedAt();
}
