package com.hyanghae.backend.community.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 게시글 작성 요청입니다.
 *
 * <p>여기서 말하는 게시글은 <b>자유 게시판 글</b>입니다. 후기는 향수에 매달리는 다른 자료라
 * {@code review} 도메인이 담당합니다.
 *
 * <p>분류를 번호가 아니라 코드로 받습니다. 분류 번호는 자동 증가라 환경마다 다르고, 화면은
 * 와이어프레임이 정한 코드(COLLECTION · RECOMMEND · CHAT)만 알고 있습니다. 번호를 요구하면
 * 화면이 분류 목록을 한 번 더 조회해 코드를 번호로 바꿔야 합니다.
 *
 * <p>{@code title} 의 길이 제한은 {@code posts.title} 이 50자라 거기에 맞춘 것입니다. 더 길게
 * 받으면 저장할 때 잘리거나 실패합니다.
 *
 * <p>{@code perfumeIds} 와 {@code imageUrls} 는 없어도 됩니다. 자유 게시판 글은 향수를 걸지 않을
 * 수 있고, 이미지도 선택입니다. 둘 다 보낸 순서를 그대로 보여줄 순서로 씁니다.
 *
 * <p>이미지는 주소만 받습니다. 파일을 올리는 방법은 아직 정해지지 않았습니다.
 */
public record PostCreateRequest(
        @NotBlank(message = "분류를 골라야 합니다.")
        String category,

        @NotBlank(message = "제목을 입력해야 합니다.")
        @Size(max = 50, message = "제목은 50자까지 쓸 수 있습니다.")
        String title,

        @NotBlank(message = "내용을 입력해야 합니다.")
        String content,

        List<@NotNull @Positive Long> perfumeIds,

        List<@NotBlank String> imageUrls
) {
}
