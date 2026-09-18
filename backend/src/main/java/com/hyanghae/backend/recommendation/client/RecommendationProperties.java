package com.hyanghae.backend.recommendation.client;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 자연어 추천의 설정입니다.
 *
 * <p>기본값을 yaml 이 아니라 여기에 둡니다. 프로필이 세 개라 yaml 에 두면 같은 값을 세 곳에
 * 적게 되고, 한 곳을 빼먹으면 그 프로필만 다르게 동작합니다. yaml 은 바꿀 값만 적습니다.
 *
 * @param topK      한 번에 받을 향수 수입니다. AI 서버가 1~20 만 받습니다.
 * @param ai        AI 서버 접속 정보입니다.
 * @param rateLimit 호출량 제한입니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.recommendation")
public record RecommendationProperties(
        @DefaultValue("5") @Min(1) @Max(20) int topK,
        @DefaultValue @Valid @NotNull Ai ai,
        @DefaultValue @Valid @NotNull RateLimit rateLimit
) {

    /**
     * AI 서버 접속 정보입니다.
     *
     * <p>AI 서버는 한국어 문장을 향 조건으로 바꾸고 향수를 찾는 별도 프로세스입니다.
     * <b>외부에 열지 않습니다</b> — 인증과 호출량 제한은 전부 이 백엔드가 합니다.
     *
     * @param baseUrl        AI 서버 주소입니다. 기본값은 로컬에서 직접 띄웠을 때의 주소입니다.
     *                       Compose 로 전체를 띄우면 컨테이너 이름으로 붙어야 하므로
     *                       {@code compose.manual-test.yaml} 이 {@code http://ai:8000} 으로
     *                       덮어씁니다.
     * @param connectTimeout 연결 제한 시간입니다. 같은 네트워크 안이라 짧게 잡습니다. 여기서
     *                       오래 기다리는 것은 AI 서버가 느린 것이 아니라 떠 있지 않은 것입니다.
     * @param readTimeout    응답 대기 제한 시간입니다. 계약서가 정한 8초입니다. 실측으로 LLM
     *                       호출이 중앙값 1.47초·최대 3.02초이고 조건을 못 뽑으면 한 번 더
     *                       불러 최악 5~6초라, 거기에 여유를 둔 값입니다.
     *                       <p>브라우저 → 백엔드가 10초라 이보다 길게 잡으면 안 됩니다.
     *                       화면이 먼저 끊기고 이쪽 요청만 남습니다.
     */
    public record Ai(
            @DefaultValue("http://localhost:8000") @NotBlank String baseUrl,
            @DefaultValue("2s") @NotNull Duration connectTimeout,
            @DefaultValue("8s") @NotNull Duration readTimeout
    ) {
    }

    /**
     * 호출량 제한입니다.
     *
     * <p>추천 한 번이 AI 서버의 LLM 호출로 이어집니다. 비용이 나가고, 실측 중앙값이 1.47초라
     * 동시에 몰리면 AI 서버가 먼저 막힙니다. AI 서버는 외부에 열려 있지 않고 스스로를 지키지
     * 않으므로 <b>여기서 막지 않으면 막는 곳이 없습니다.</b>
     *
     * <p>회원과 비회원의 한도가 다릅니다. 계약서가 정한 유일한 차이입니다 — 결과는 같습니다.
     *
     * @param window    한도를 세는 구간입니다. 첫 호출에서 구간이 시작됩니다.
     * @param member    로그인한 회원이 한 구간에 부를 수 있는 횟수입니다.
     * @param anonymous 비회원이 한 구간에 부를 수 있는 횟수입니다. <b>같은 IP 를 함께 셉니다</b>
     *                  — 공유 회선 뒤의 여러 사람이 한 바구니를 씁니다. 그래서 회원보다 적게
     *                  두되 너무 조이지 않습니다.
     */
    public record RateLimit(
            @DefaultValue("1m") @NotNull Duration window,
            @DefaultValue("30") @Min(1) int member,
            @DefaultValue("10") @Min(1) int anonymous,

            /*
             * 클릭과 만족도의 한도입니다. 추천과 셈을 나누고 한도도 따로 둡니다.
             *
             * 추천보다 넉넉한 이유는 한 번의 추천이 여러 번의 클릭을 부르기 때문입니다. 카드가
             * 다섯이라 다 눌러 보고 만족도까지 남기면 여섯 번입니다. 추천 한도(비회원 10)를
             * 그대로 쓰면 추천 두 번에 한도가 찹니다.
             *
             * 비용도 다릅니다. 추천은 LLM 을 불러 돈이 나가고, 이쪽은 한 칸을 고칩니다.
             */
            @DefaultValue("120") @Min(1) int feedbackMember,
            @DefaultValue("60") @Min(1) int feedbackAnonymous
    ) {
    }
}
