package com.hyanghae.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code @EnableScheduling} 이 여기 있습니다.
 *
 * <p>원래 후기 요약 배치 설정에 있었습니다. 그때는 스케줄 작업이 그 배치 하나뿐이라 둘 곳이
 * 거기밖에 없었고, 그 설정의 주석이 <i>"다른 도메인이 {@code @Scheduled} 를 추가하면 이
 * 선언을 애플리케이션 공용 설정으로 옮겨야 합니다"</i> 라고 적어 두었습니다. 자연어 추천의
 * 보관 기간 배치가 생겨 그대로 옮겼습니다.
 *
 * <p>한 도메인의 설정에 두면 그 도메인을 끄거나 옮길 때 다른 도메인의 배치가 조용히 멈춥니다.
 */
@SpringBootApplication
@EnableScheduling
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

}
