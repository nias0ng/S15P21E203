package com.hyanghae.backend.taste.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * 취향 테스트를 마쳤다는 요청입니다. 회원가입 뒤 첫 로그인에 한 번 보냅니다.
 *
 * <p>{@code picks} 는 고른 향 계열의 코드이고 <b>순서가 순위</b>입니다. 첫 번째가 1순위입니다.
 * 화면이 1순위에 0.58, 2순위에 0.42 를 주므로 순서가 뒤집히면 다른 향수가 뽑힙니다.
 *
 * <p>1개만 보낼 수 있습니다. 화면이 한 개만 고르는 것을 허용하고, 그때는 그 계열에 1.0 을 줍니다.
 *
 * <p>{@code matchedPerfumeId} 는 화면이 고른 결과 향수입니다. <b>서버가 다시 계산하지
 * 않습니다.</b> 코사인 유사도 계산이 이미 화면에 있고 테스트도 거기 붙어 있어, 같은 규칙을 자바로
 * 한 벌 더 두면 두 결과가 갈릴 때 어느 쪽이 맞는지 판단할 근거가 없습니다. 대신 두 가지는 서버가
 * 확인합니다 — 지도에 있는지(없으면 배를 띄울 자리가 없습니다)와, 1순위 계열의 이름표 조각 안에
 * 그려져 있는지(밖이면 고른 계열에서 시작한 것으로 보이지 않습니다)입니다.
 */
public record TasteTestCreateRequest(

        @Schema(description = "고른 향 계열 코드. 순서가 순위이고 1~2개입니다.",
                example = "[\"FLORAL\", \"WOODY\"]")
        List<String> picks,

        @Schema(description = "화면이 고른 결과 향수. 향 지도에 있고, 1순위 계열의 이름표 조각 안에"
                + " 그려진 향수여야 합니다(GET /api/v1/map/scent-vectors 의 labelRegionCode).",
                example = "42")
        Long matchedPerfumeId
) {
}
