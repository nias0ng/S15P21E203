package com.hyanghae.backend.shelf.entity;

/**
 * 진열대에서 사용자가 향수를 분류하는 상태입니다.
 *
 * <p>값은 {@code user_perfumes.ownership_status}에 문자열로 저장되므로 이름을 변경할 때는
 * 기존 데이터와 API 계약을 함께 마이그레이션해야 합니다.
 */
public enum OwnershipStatus {

    OWNED,
    TRIED,
    WISH
}
