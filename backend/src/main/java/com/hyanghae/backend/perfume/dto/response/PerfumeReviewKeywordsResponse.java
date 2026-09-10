package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 후기 키워드 통계 응답입니다.
 *
 * <p>계절 통계와 달리 값이 없는 키워드를 0 으로 채우지 않습니다. 계절은 네 개로 고정이라 화면이
 * 빈 칸을 그려야 하지만, 키워드는 어휘가 열려 있어 "나오지 않은 키워드" 전부를 내려줄 수 없습니다.
 *
 * <p>많이 나온 순으로 정렬합니다. 화면이 앞에서 몇 개만 잘라 쓰면 됩니다.
 *
 * <p>후기가 정책 개수만큼 쌓여 후기 요약·키워드 배치가 돌기 전인 향수는 빈 배열입니다.
 */
@Schema(description = "후기 키워드 통계 응답입니다.")
public record PerfumeReviewKeywordsResponse(

        @Schema(
                description = """
                        후기에서 뽑힌 향 표현입니다. 많이 나온 순으로 정렬하고, 같으면 키워드 이름순입니다. \
                        나온 키워드만 담습니다. 계절 통계처럼 없는 항목을 0 으로 채우지 않습니다. \
                        뽑힌 키워드가 없으면 null 이 아니라 빈 배열입니다. 키워드는 후기가 일정 개수 \
                        쌓인 뒤 배치가 적재하므로, 그 전인 향수는 빈 배열입니다.""")
        List<PerfumeReviewKeywordResponse> keywords
) {
}
