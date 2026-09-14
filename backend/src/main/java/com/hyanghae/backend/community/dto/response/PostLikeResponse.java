package com.hyanghae.backend.community.dto.response;

/**
 * 좋아요를 누르거나 취소한 뒤의 상태입니다.
 *
 * <p>둘 다 보내는 이유가 있습니다. 화면은 하트를 칠할지({@code liked})와 옆의 숫자를
 * ({@code likeCount}) 함께 갱신해야 하는데, 숫자를 안 보내면 화면이 스스로 더하고 빼야 합니다.
 * 그러면 다른 사람이 그 사이에 누른 것이 반영되지 않아 새로고침할 때 숫자가 튑니다.
 *
 * <p>여러 번 눌러도 같은 값이 나옵니다. 이미 누른 글에 또 누르면 {@code liked} 는 그대로 참이고
 * {@code likeCount} 도 오르지 않습니다.
 */
public record PostLikeResponse(Long postId, boolean liked, long likeCount) {
}
