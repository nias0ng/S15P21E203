package com.hyanghae.backend.recommendation.batch;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 자연어 추천 기록의 보관 기간 설정입니다.
 *
 * <p><b>기본이 켜짐입니다.</b> 후기 요약 배치는 기본이 꺼짐인데 그것은 돌 때마다 외부 API 를
 * 불러 비용이 나가기 때문입니다. 이쪽은 인덱스가 걸린 칸으로 {@code UPDATE} 두 번이라 비용이
 * 없고, <b>꺼 두면 정해 놓은 보관 기간이 지켜지지 않습니다.</b> 정책이 있는데 실행이 없는 것은
 * 정책이 없는 것보다 나쁩니다 — 지켜지고 있다고 착각하게 됩니다.
 *
 * @param enabled       끄면 원문이 계속 쌓입니다. 끌 이유가 있을 때만 끄십시오.
 * @param retentionDays 이 날짜가 지난 요청의 원문을 비웁니다. 팀이 30일로 정했습니다.
 * @param cron          하루 한 번입니다. 사람이 적게 쓰는 시각으로 잡았습니다.
 * @param zone          {@code cron} 을 읽을 시간대입니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.recommendation.retention")
public record NlrRetentionProperties(

        @DefaultValue("true") boolean enabled,

        @DefaultValue("30") @Min(1) int retentionDays,

        @DefaultValue("0 30 4 * * *") @NotBlank String cron,

        @DefaultValue("Asia/Seoul") @NotBlank String zone
) {
}
