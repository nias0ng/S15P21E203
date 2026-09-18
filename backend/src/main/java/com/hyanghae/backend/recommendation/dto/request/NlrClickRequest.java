package com.hyanghae.backend.recommendation.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 추천 결과에서 어느 카드를 눌렀는지입니다.
 *
 * <p><b>향수 번호가 아니라 순위를 받습니다.</b> 알고 싶은 것이 "몇 위를 눌렀나" 이고, 그 값은
 * 추천 품질을 바로 말해 주기 때문입니다. 향수 번호는 서버가 이미 그 순위에 적어 두었습니다.
 *
 * <p>번호로 받으면 같은 향수가 두 순위에 있을 때 어느 쪽을 눌렀는지 알 수 없고, 그 추천에 없던
 * 향수 번호를 보낼 수도 있습니다.
 *
 * @param rank 1~5 입니다. 추천은 다섯 개까지라 그 범위를 벗어난 값은 순위가 아닙니다.
 */
public record NlrClickRequest(

        @Schema(description = "누른 카드의 순위입니다. 1이 가장 위입니다.",
                example = "2", minimum = "1", maximum = "5")
        @NotNull
        @Min(1)
        @Max(5)
        Integer rank
) {
}
