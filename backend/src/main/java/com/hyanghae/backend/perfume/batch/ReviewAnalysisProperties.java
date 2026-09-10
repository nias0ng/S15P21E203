package com.hyanghae.backend.perfume.batch;

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
 * 후기 요약·키워드 배치의 설정입니다.
 *
 * <p>기본값을 yaml 이 아니라 여기에 둡니다. 프로필이 세 개라 yaml 에 두면 같은 값을 세 곳에
 * 적게 되고, 한 곳을 빼먹으면 그 프로필만 다르게 동작합니다. yaml 은 바꿀 값만 적습니다.
 *
 * <p>{@code enabled} 기본값이 {@code false} 인 이유가 있습니다. 켜져 있으면 애플리케이션이
 * 뜨는 것만으로 외부 API 를 호출해 비용이 발생합니다. 로컬 실행이나 테스트가 그러면 안 됩니다.
 *
 * @param enabled              배치 실행 여부입니다. 켤 때 {@code gms.api-key} 가 반드시 있어야 합니다.
 * @param cron                 실행 주기입니다. 초 단위가 앞에 오는 여섯 자리 표현식입니다.
 * @param zone                 {@code cron} 을 해석할 시간대입니다.
 * @param minReviewCount       요약을 만들기 시작하는 최소 후기 수입니다.
 * @param regenerationStep     요약 이후 후기가 이만큼 늘어나면 다시 만듭니다.
 * @param maxPerfumesPerRun    한 번 실행에서 처리할 향수 수입니다. 한 번의 비용 상한입니다.
 * @param maxReviewsPerRequest 한 향수에서 AI 에게 보낼 후기 수입니다. 최근 후기부터 채웁니다.
 * @param maxReviewLength      후기 하나를 보낼 때 자르는 길이입니다.
 * @param maxKeywordLength     받아들일 키워드 이름의 최대 길이입니다.
 * @param maxKeywordsPerReview 후기 하나에서 받아들일 키워드 수입니다.
 * @param maxSummaryLength     저장할 요약의 최대 길이입니다.
 * @param gms                  GMS 접속 정보입니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.review-analysis")
public record ReviewAnalysisProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("0 10 * * * *") @NotBlank String cron,
        @DefaultValue("Asia/Seoul") @NotBlank String zone,
        @DefaultValue("5") @Min(1) int minReviewCount,
        @DefaultValue("10") @Min(1) int regenerationStep,
        @DefaultValue("20") @Min(1) int maxPerfumesPerRun,
        @DefaultValue("50") @Min(1) int maxReviewsPerRequest,
        @DefaultValue("1000") @Min(1) int maxReviewLength,
        @DefaultValue("50") @Min(1) @Max(50) int maxKeywordLength,
        @DefaultValue("5") @Min(1) int maxKeywordsPerReview,
        @DefaultValue("1000") @Min(1) int maxSummaryLength,
        @DefaultValue @Valid @NotNull Gms gms
) {

    /**
     * GMS 접속 정보입니다.
     *
     * <p>GMS 는 상용 LLM API 앞에 놓인 프록시입니다. {@code baseUrl} 뒤의 경로와 요청·응답
     * 형식은 원래 API 그대로입니다. 지금은 OpenAI 호환 형식({@code /chat/completions})을
     * 씁니다.
     *
     * <p>{@code apiKey} 기본값은 빈 문자열입니다. 저장소에 키를 두지 않으므로 환경변수로만
     * 들어옵니다. 값이 없는데 배치를 켜면 {@link ReviewAnalysisScheduler} 가 시작 시점에
     * 실패시킵니다. 인증 없이 호출해 매 실행마다 401 을 받는 것보다 낫습니다.
     *
     * @param apiKey         GMS 키입니다. 로그와 예외 메시지에 절대 넣지 않습니다.
     * @param model          호출할 모델 이름입니다. GMS 가 허용하는 이름이어야 합니다. 세대를
     *                       바꿀 때는 {@code GmsChatRequest} 가 보내는 필드와 메시지 역할이
     *                       그 모델에서 유효한지 함께 확인해야 합니다.
     * @param connectTimeout 연결 제한 시간입니다.
     * @param readTimeout    응답 대기 제한 시간입니다. 요약 생성은 수십 초가 걸릴 수 있습니다.
     */
    public record Gms(
            @DefaultValue("https://gms.ssafy.io/gmsapi/api.openai.com/v1") @NotBlank String baseUrl,
            @DefaultValue("") String apiKey,
            @DefaultValue("gpt-5-nano") @NotBlank String model,
            @DefaultValue("10s") @NotNull Duration connectTimeout,
            @DefaultValue("60s") @NotNull Duration readTimeout
    ) {
    }
}
