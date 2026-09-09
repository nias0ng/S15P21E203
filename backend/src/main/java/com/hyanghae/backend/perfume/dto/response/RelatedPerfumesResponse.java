package com.hyanghae.backend.perfume.dto.response;

import java.util.List;

/**
 * 주변 향수와 유사 향수의 공통 응답입니다.
 *
 * <p>목록 필드 이름이 API 명세대로 {@code perfumes} 입니다.
 *
 * <p>페이징 응답이 아닙니다. 명세에 {@code page} 와 {@code totalElements} 가 없고 {@code size}
 * 만 있어, 전체를 나눠 보는 것이 아니라 앞에서 몇 개만 잘라 보여주는 목록으로 읽었습니다.
 */
public record RelatedPerfumesResponse(List<RelatedPerfumeResponse> perfumes) {
}
