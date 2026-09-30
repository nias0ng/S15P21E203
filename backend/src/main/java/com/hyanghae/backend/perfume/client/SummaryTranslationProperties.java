package com.hyanghae.backend.perfume.client;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 후기 요약 번역의 제한 시간입니다.
 *
 * <p>GMS 의 주소 · 키 · 모델은 후기 요약 배치의 설정({@code hyanghae.review-analysis.gms})을 함께
 * 씁니다. 같은 GMS 이고, 키를 두 곳에 넣게 하면 한쪽만 넣는 실수가 생깁니다.
 *
 * <p>제한 시간만 따로 둡니다. 배치는 후기 여러 건을 보내 수십 초를 기다려도 되지만, 번역은
 * 사용자가 상세 화면을 여는 요청 안에서 돕니다. 오래 기다리느니 한국어 요약을 먼저 보여주는 것이
 * 낫습니다. 요약 네 줄을 옮기는 일이라 몇 초면 끝납니다.
 *
 * @param connectTimeout 연결 제한 시간입니다.
 * @param readTimeout    응답 대기 제한 시간입니다. 넘기면 이번 요청은 한국어 요약을 받습니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.review-summary-translation")
public record SummaryTranslationProperties(
        @DefaultValue("3s") @NotNull Duration connectTimeout,
        @DefaultValue("8s") @NotNull Duration readTimeout
) {
}
