package com.hyanghae.backend.review.dto.response;

import java.util.List;

/**
 * 후기 게시판 한 페이지입니다.
 *
 * <p>{@code totalElements} 는 이 페이지가 아니라 전체 후기 수입니다. 화면이 페이지 번호를 몇 개
 * 그릴지 정하는 값입니다.
 *
 * <p>Spring 의 {@code Page} 를 그대로 내보내지 않습니다. 직렬화 모양이 Spring 버전에 매여 있고
 * 목록 필드 이름도 {@code content} 로 고정됩니다. 화면이 읽을 이름은 우리가 정합니다.
 */
public record ReviewBoardResponse(
        List<ReviewBoardItemResponse> reviews,
        int page,
        int size,
        long totalElements
) {
}
