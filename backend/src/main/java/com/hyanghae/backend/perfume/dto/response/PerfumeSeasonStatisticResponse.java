package com.hyanghae.backend.perfume.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * 계절 하나의 후기 통계입니다.
 *
 * <p>{@code percentage} 는 0 이상 100 이하입니다. 화면이 그대로 쓸 수 있도록 백분율로 내려줍니다.
 * 소수점 한 자리까지 줍니다. 3분의 1 을 정수로 반올림하면 33 이 되어 원래 값과 0.33 포인트가
 * 차이 나는데, 한 자리를 남기면 33.3 이 됩니다.
 *
 * <p>분모는 계절을 하나라도 고른 후기 수입니다. 후기 하나가 계절을 여러 개 고를 수 있어
 * 계절별 {@code percentage} 의 합이 100 을 넘을 수 있습니다.
 *
 * <p>같은 설명을 {@link Schema} 로 한 번 더 적습니다. javadoc 은 Swagger 로 나가지 않아
 * 애너테이션이 없으면 문서에 타입만 남습니다.
 */
@Schema(description = "계절 하나의 후기 통계입니다.")
public record PerfumeSeasonStatisticResponse(

        @Schema(description = "계절 번호", example = "1")
        Long seasonId,

        @Schema(description = "계절 코드", example = "SPRING",
                allowableValues = {"SPRING", "SUMMER", "AUTUMN", "WINTER"})
        String code,

        @Schema(description = "계절 이름", example = "봄")
        String name,

        @Schema(description = "이 계절을 고른 후기 수", example = "5")
        long count,

        @Schema(
                description = """
                        이 계절을 고른 후기의 비중입니다. 단위는 퍼센트(0~100)이고 소수점 한 자리까지 \
                        내려줍니다. 분모는 계절을 하나라도 고른 후기 수이고, 계절을 고르지 않은 후기는 \
                        분모에서 빠집니다. 후기 하나가 계절을 여러 개 고를 수 있으므로 네 계절의 합이 \
                        100 을 넘을 수 있습니다. 비율을 그대로 쓰는 원형 차트나 누적 막대에는 맞지 않습니다.""",
                minimum = "0",
                maximum = "100",
                example = "33.3")
        BigDecimal percentage
) {
}
