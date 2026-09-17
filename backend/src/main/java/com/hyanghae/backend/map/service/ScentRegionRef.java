package com.hyanghae.backend.map.service;

/**
 * 향 계열 영역을 가리키는 최소한의 값입니다.
 *
 * <p>{@code code} 를 함께 두는 이유는 화면이 계열을 코드로 다루기 때문입니다. 번호는 서버가
 * 쓰는 키이고, 화면은 {@code CITRUS} 처럼 읽을 수 있는 값으로 색과 이름을 고릅니다.
 */
public record ScentRegionRef(Long scentRegionId, String code) {
}
