package com.hyanghae.backend.community.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 지금 많이 언급되는 향수 목록입니다. 언급이 없으면 빈 배열입니다.
 *
 * @param days     몇 일치를 셌는지입니다. 화면이 "최근 N일" 처럼 쓸 수 있게 함께 보냅니다.
 * @param perfumes 많이 언급된 순입니다.
 */
public record TrendingPerfumesResponse(
        @Schema(description = "집계한 기간(일)", example = "7")
        int days,

        List<TrendingPerfumeResponse> perfumes
) {
}
