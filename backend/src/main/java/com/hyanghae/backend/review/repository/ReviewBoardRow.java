package com.hyanghae.backend.review.repository;

import java.time.Instant;

/**
 * 후기 게시판 한 줄입니다.
 *
 * <p>향수를 함께 싣습니다. 향수 상세의 후기 목록({@link PerfumeReviewListRow})과 다른 점이
 * 여기입니다. 거기서는 어느 향수인지 이미 알지만, 게시판은 여러 향수의 후기가 섞여 나오므로 줄마다
 * 어느 향수 이야기인지 보여야 합니다.
 *
 * <p>인터페이스인 이유는 네이티브 결과를 레코드 생성자로 바로 받을 수 없기 때문입니다. Spring
 * Data 가 컬럼 별칭을 보고 구현을 만들어 줍니다.
 *
 * <p>시각이 {@link Instant} 인 것도 같은 사정입니다. 네이티브 결과의 {@code timestamptz} 를
 * Hibernate 가 {@link Instant} 로 읽어 주는데, 프로젝션이 다른 시간 타입을 요구하면 변환하지
 * 못하고 실패합니다.
 *
 * <p>계절은 여기 없습니다. 후기 하나가 여럿을 고를 수 있어 한 줄에 담기지 않습니다. 서비스가
 * 번호를 모아 따로 읽습니다.
 */
public interface ReviewBoardRow {

    Long getReviewId();

    String getTitle();

    String getContent();

    String getNickname();

    /** 작성자가 탈퇴했거나 사진을 설정하지 않았으면 비어 있습니다. */
    String getProfileImageUrl();

    Long getPerfumeId();

    String getPerfumeName();

    String getPerfumeNameKo();

    String getBrand();

    String getBrandKo();

    long getLikeCount();

    long getViewCount();

    Instant getCreatedAt();

    Instant getUpdatedAt();
}
