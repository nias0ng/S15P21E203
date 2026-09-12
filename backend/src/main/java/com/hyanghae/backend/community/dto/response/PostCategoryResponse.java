package com.hyanghae.backend.community.dto.response;

/**
 * 글의 분류입니다.
 *
 * <p>{@code code} 를 함께 주는 이유는 화면이 분류를 코드로 다루기 때문입니다. 번호는 서버가 쓰는
 * 키이고, 화면은 {@code COLLECTION} 같은 값으로 라벨과 색을 고릅니다.
 */
public record PostCategoryResponse(Long categoryId, String code, String name) {
}
