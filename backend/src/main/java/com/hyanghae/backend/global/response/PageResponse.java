package com.hyanghae.backend.global.response;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * 목록 응답의 공통 형식입니다.
 *
 * <p>Spring의 {@link Page}를 그대로 직렬화하면 현재 페이지 번호가 {@code number}로 나가지만
 * 프론트엔드(features/perfume/types.ts의 {@code Page<T>})는 {@code page}를 읽습니다.
 * 그래서 한 번 감싸 형식을 맞춥니다.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
