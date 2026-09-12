package com.hyanghae.backend.community.dto.response;

import java.time.OffsetDateTime;

/**
 * 목록에 한 줄로 나오는 글입니다.
 *
 * <p>{@code category} 는 분류 코드입니다(COLLECTION · RECOMMEND · CHAT). 화면이 코드로 이름표를
 * 만들기 때문에 한글 이름은 보내지 않습니다.
 *
 * <p>{@code perfume} 은 글에 걸린 향수 중 <b>대표 하나</b>입니다. 목록 한 줄에는 향수 블록이
 * 하나만 들어가고, 여러 개를 보내면 화면이 매번 하나를 골라야 합니다. 고르는 규칙이 화면마다
 * 달라지지 않도록 서버가 정합니다. 향수를 걸지 않은 글은 비어 있습니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 글은 남고 작성자만 지워집니다
 * ({@code posts.user_id} 가 {@code ON DELETE SET NULL} 입니다).
 */
public record PostSummaryResponse(
        Long postId,
        String category,
        String title,
        String nickname,
        PostPerfumeResponse perfume,
        OffsetDateTime createdAt
) {
}
