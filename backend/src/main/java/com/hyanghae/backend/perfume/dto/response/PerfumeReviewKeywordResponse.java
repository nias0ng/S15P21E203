package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * 후기에서 자주 나온 향 표현 하나입니다.
 *
 * <p>{@code percentage} 는 0 이상 100 이하이고, 이 키워드가 나온 후기의 비중입니다. 분모는
 * 키워드가 하나라도 뽑힌 후기 수입니다. 후기 하나에서 키워드가 여러 개 나올 수 있어 합이 100 을
 * 넘을 수 있습니다.
 *
 * <p>계절 통계와 같이 소수점 한 자리까지 줍니다.
 *
 * <p>같은 설명을 {@link Schema} 로 한 번 더 적습니다. javadoc 은 Swagger 로 나가지 않아
 * 애너테이션이 없으면 문서에 타입만 남습니다.
 */
@Schema(description = "후기에서 자주 나온 향 표현 하나입니다.")
public record PerfumeReviewKeywordResponse(

        @Schema(description = "향 표현", example = "포근한")
        String keyword,

        @Schema(
                description = """
                        이 키워드가 나온 후기의 비중입니다. 단위는 퍼센트(0~100)이고 소수점 한 자리까지 \
                        내려줍니다. 분모는 키워드가 하나라도 뽑힌 후기 수이고, 키워드가 하나도 없는 후기는 \
                        분모에서 빠집니다. 후기 하나에서 키워드가 여러 개 나올 수 있으므로 \
                        keywords 전체의 합이 100 을 넘을 수 있습니다. 비율을 그대로 쓰는 원형 차트나 \
                        누적 막대에는 맞지 않습니다.""",
                minimum = "0",
                maximum = "100",
                example = "62.5")
        BigDecimal percentage
) {
}
