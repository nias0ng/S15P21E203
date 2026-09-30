package com.hyanghae.backend.community.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 최근 글에 많이 언급된 향수입니다.
 *
 * <p>{@code mentionCount} 는 <b>이 향수를 건 글의 수</b>입니다. 한 글이 같은 향수를 두 번 걸 수
 * 없으므로({@code post_perfumes} 의 기본키가 (글, 향수)입니다) 글 수와 같습니다.
 *
 * <p>향수 검색의 인기 순({@code ranking})과 <b>다른 값입니다.</b> 그쪽은 담거나 열어 본 횟수라
 * 혼자 보는 행동이고, 이쪽은 글에 써서 남들에게 보인 횟수입니다.
 *
 * <p>이름이 둘씩입니다. 영어 화면은 {@code name} · {@code brand} 를, 한국어 화면은
 * {@code nameKo} · {@code brandKo} 를 적고, 한국어 이름이 비어 있으면 원래 이름으로 되돌아갑니다.
 */
public record TrendingPerfumeResponse(
        @Schema(description = "향수 ID", example = "1")
        Long perfumeId,

        @Schema(description = "향수 원래(영문) 이름", example = "Bleu de Chanel")
        String name,

        @Schema(description = "향수 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "블루 드 샤넬", nullable = true)
        String nameKo,

        @Schema(description = "브랜드 원래(영문) 이름. 인계 데이터에 브랜드가 없는 향수가 있습니다.",
                example = "Chanel", nullable = true)
        String brand,

        @Schema(description = "브랜드 한국어 이름. 비어 있으면 화면은 원래 이름을 적습니다.",
                example = "샤넬", nullable = true)
        String brandKo,

        @Schema(description = "대표 이미지 주소", nullable = true)
        String thumbnailUrl,

        @Schema(description = "이 향수를 건 글의 수", example = "7")
        long mentionCount
) {
}
