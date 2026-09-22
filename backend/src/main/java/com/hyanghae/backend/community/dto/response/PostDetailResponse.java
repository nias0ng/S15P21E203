package com.hyanghae.backend.community.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 게시글 상세입니다. 로그인하지 않아도 볼 수 있습니다.
 *
 * <p>{@code category} 는 분류 코드입니다(COLLECTION · RECOMMEND · CHAT).
 *
 * <p>{@code mine} 은 보는 사람마다 다릅니다. 수정·삭제 버튼을 띄울지 정하는 값이라 글쓴이에게만
 * 참이고 비로그인에게는 거짓입니다. 버튼을 숨기는 것으로 권한이 지켜지지는 않으므로 수정·삭제
 * API 가 작성자를 다시 확인합니다.
 *
 * <p>{@code nickname} 이 비어 있을 수 있습니다. 회원이 탈퇴하면 글은 남고 작성자만 지워집니다.
 * 그런 글은 주인이 없어 아무도 고칠 수 없고 {@code mine} 도 항상 거짓입니다.
 * {@code profileImageUrl} 도 함께 비어 나갑니다.
 *
 * <p>{@code profileImageUrl} 의 값 규칙은 {@code UserResponse} 와 같습니다. 사진을 설정하지
 * 않았으면 {@code null} 이고 화면이 기본 아바타를 보여줍니다.
 *
 * <p>{@code collectionTitle} 은 <b>글을 쓸 때 박제한</b> 컬렉션 이름입니다. 그 뒤에 컬렉션
 * 이름이 바뀌거나 컬렉션이 지워져도 이 값은 그대로입니다. 글은 그때 그 컬렉션을 소개한
 * 기록이지 지금의 컬렉션을 비추는 창이 아닙니다. {@code relatedPerfumes} 도 같은 시점에 복사한
 * 목록입니다.
 *
 * <p>{@code collectionId} 는 <b>원본이 아직 있을 때만</b> 채워집니다. 컬렉션을 지우면 비지만
 * 이름과 향수는 남습니다. 남의 컬렉션은 열어볼 수 없으므로 화면은 글쓴이 본인에게만 이 번호를
 * 씁니다.
 *
 * <p>{@code imageUrls} 와 {@code relatedPerfumes} 는 글에 걸어 둔 순서 그대로입니다.
 *
 * <p>{@code liked} 도 보는 사람마다 다릅니다. 하트를 칠할지 정하는 값이라 내가 누른 글에만
 * 참이고, 비로그인에게는 항상 거짓입니다.
 *
 * <p>{@code viewCount} 는 <b>이번 조회를 포함한</b> 수입니다. 상세를 열 때 올리고 올린 값을
 * 보냅니다. 열었는데 숫자가 그대로면 올라가지 않은 것처럼 보이기 때문입니다.
 *
 * <p>명세에 있던 {@code status}·{@code holdReason} 은 없습니다. 게시글 보류 기능이 없어지면서
 * 두 컬럼이 V5 에서 삭제됐습니다. 글은 있거나 지워졌거나 둘 중 하나입니다.
 */
public record PostDetailResponse(
        Long postId,
        String category,
        String nickname,

        @Schema(description = "작성자 프로필 사진 주소. 설정하지 않았거나 탈퇴한 작성자면 null",
                nullable = true,
                example = "/api/v1/users/profile-images/2026/09/0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9.jpg")
        String profileImageUrl,

        String title,
        String content,
        List<String> imageUrls,
        List<PostPerfumeResponse> relatedPerfumes,
        Long collectionId,
        String collectionTitle,
        long commentCount,
        long likeCount,
        long viewCount,
        boolean liked,
        boolean mine,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
