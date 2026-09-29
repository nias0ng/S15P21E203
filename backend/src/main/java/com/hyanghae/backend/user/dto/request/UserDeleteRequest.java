package com.hyanghae.backend.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * 탈퇴할 때 본인임을 확인하는 값입니다.
 *
 * <p>비밀번호로 가입한 계정은 {@code password} 를 보냅니다. Google 로 가입한 계정은 비워 보내고, 대신
 * 5분 안에 {@code POST /api/v1/auth/google/reauth} 로 Google 재확인을 마쳐야 합니다. 어느 쪽인지는 내
 * 정보의 {@code hasPassword} 로 압니다.
 */
public record UserDeleteRequest(
        @Schema(description = "본인 확인용 비밀번호. 비밀번호로 가입한 계정일 때", format = "password",
                nullable = true)
        @Size(max = 64)
        String password
) {
}
