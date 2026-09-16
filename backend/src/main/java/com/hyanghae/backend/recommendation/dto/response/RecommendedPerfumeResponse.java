package com.hyanghae.backend.recommendation.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 추천된 향수 한 건입니다.
 *
 * <p>{@code perfumeId} 는 우리 DB 의 {@code perfume_id} 입니다. 상세 페이지·컬렉션이 같은
 * 값을 쓰므로 화면이 이 값으로 링크를 걸 수 있습니다. <b>AI 가 찾은 향수라도 우리 DB 에
 * 없으면 이 목록에 들어오지 않습니다</b> — 번호를 채울 수 없고, 채우지 못한 채 이름만
 * 내보내면 눌러도 아무 데도 가지 않는 카드가 됩니다.
 *
 * @param name         향수 이름입니다. 한국어 이름이 있으면 한국어, 없으면 영어입니다.
 *                     {@code perfumes.name_ko} 가 아직 대부분 비어 있어 지금은 영어가 나갑니다.
 * @param brand        브랜드 이름입니다. 같은 규칙이고, 브랜드가 없는 향수면 {@code null} 입니다.
 * @param thumbnailUrl 대표 이미지 주소입니다. 이미지가 없는 향수가 많아 {@code null} 이 흔합니다.
 * @param reasons      추천 이유입니다. 1~3개입니다.
 */
public record RecommendedPerfumeResponse(

        @Schema(description = "우리 DB 의 향수 번호입니다. 상세 페이지 링크에 씁니다.", example = "1234")
        Long perfumeId,

        @Schema(description = "향수 이름입니다. 한국어 이름이 없으면 영어입니다.",
                example = "Lazy Sunday Morning")
        String name,

        @Schema(description = "브랜드 이름입니다. 브랜드가 없는 향수면 null 입니다.",
                example = "Maison Martin Margiela", nullable = true)
        String brand,

        @Schema(description = "대표 이미지 주소입니다. 이미지가 없으면 null 입니다.", nullable = true)
        String thumbnailUrl,

        @Schema(description = "추천 이유입니다. 1~3개입니다.")
        List<RecommendationReasonResponse> reasons
) {
}
