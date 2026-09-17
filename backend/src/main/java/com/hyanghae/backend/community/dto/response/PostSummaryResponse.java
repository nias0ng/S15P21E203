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
 * <p>{@code liked} 는 보는 사람마다 다릅니다. 하트를 칠할지 정하는 값이라 내가 누른 글에만
 * 참이고, 비로그인에게는 항상 거짓입니다. {@code likeCount} 는 누구에게나 같습니다.
 *
 * <p>{@code viewCount} 는 새로고침해도 오릅니다. 보는 사람을 특정할 수 없어 같은 사람의 반복
 * 조회를 걸러내지 못합니다.
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
        long commentCount,
        long likeCount,
        long viewCount,
        boolean liked,
        OffsetDateTime createdAt
) {
}
