package com.hyanghae.backend.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 가입에 쓸 수 있는 이메일인지입니다.
 *
 * <p>{@code true} 라고 해서 가입이 반드시 성공하지는 않습니다. 확인한 뒤 가입하기 전에 다른
 * 사람이 같은 이메일로 가입할 수 있어, 가입 시점에 한 번 더 걸러집니다.
 */
public record EmailAvailabilityResponse(
        @Schema(description = "가입에 쓸 수 있으면 true", example = "true")
        boolean available
) {
}
