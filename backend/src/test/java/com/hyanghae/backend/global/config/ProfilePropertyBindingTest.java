package com.hyanghae.backend.global.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultBootstrapContext;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.DefaultResourceLoader;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 프로필 yaml 의 설정이 Spring 이 실제로 읽는 자리에 놓였는지 확인합니다.
 *
 * <p>예전에 {@code application-prod.yaml} 의 {@code jpa}·{@code flyway} 블록이 {@code spring} 이
 * 아니라 {@code server} 아래로 들여쓰기돼 있었습니다. {@code ServerProperties} 는 모르는 키를 조용히
 * 버리므로 애플리케이션은 그대로 뜨고, 운영만 {@code ddl-auto} 기본값인 {@code none} 으로 돌았습니다.
 * 엔티티와 표가 어긋나도 기동이 성공한다는 뜻입니다.
 *
 * <p>이런 실수는 사람이 보고 알아채기를 기대할 수 없습니다. <b>틀린 설정이 아니라 없는 설정</b>이 되어
 * 경고도 예외도 남지 않고, 차이가 들여쓰기 두 칸이라 리뷰에서도 눈에 띄지 않습니다. 그래서 테스트로
 * 못을 박습니다.
 *
 * <p>컨텍스트를 띄우지 않고 Spring Boot 의 설정 로딩만 돌립니다. 데이터베이스도 컨테이너도 필요 없습니다.
 */
class ProfilePropertyBindingTest {

    private static ConfigurableEnvironment environmentFor(String profile) {
        ConfigurableEnvironment environment = new StandardEnvironment();
        ConfigDataEnvironmentPostProcessor.applyTo(
                environment, new DefaultResourceLoader(), new DefaultBootstrapContext(), profile);
        return environment;
    }

    @Test
    @DisplayName("운영 프로필은 스키마 검증을 켜고 open-in-view 를 끈다")
    void prodProfileValidatesSchemaAndDisablesOpenInView() {
        ConfigurableEnvironment environment = environmentFor("prod");

        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
        assertThat(environment.getProperty("spring.flyway.enabled", Boolean.class)).isTrue();
    }

    @Test
    @DisplayName("수동 테스트 프로필도 스키마 검증을 켠다")
    void manualTestProfileValidatesSchema() {
        ConfigurableEnvironment environment = environmentFor("manual-test");

        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
    }

    /**
     * 값이 맞는지가 아니라 <b>자리가 맞는지</b>를 봅니다. 위의 두 검사는 {@code spring} 아래에 값이
     * 있으면 통과하므로, 누군가 {@code server} 아래에도 같은 블록을 두면 잡지 못합니다. 그 상태는 지금
     * 당장은 무해하지만 나중에 {@code spring} 쪽을 지우면 조용히 예전 버그로 돌아갑니다.
     */
    @Test
    @DisplayName("jpa·flyway 설정이 server 아래에 놓여 있지 않다")
    void jpaAndFlywayAreNotNestedUnderServer() {
        for (String profile : new String[] {"prod", "manual-test"}) {
            ConfigurableEnvironment environment = environmentFor(profile);

            assertThat(environment.getProperty("server.jpa.hibernate.ddl-auto"))
                    .as("%s 프로필의 ddl-auto 가 server 아래에 있습니다", profile)
                    .isNull();
            assertThat(environment.getProperty("server.jpa.open-in-view"))
                    .as("%s 프로필의 open-in-view 가 server 아래에 있습니다", profile)
                    .isNull();
            assertThat(environment.getProperty("server.flyway.enabled"))
                    .as("%s 프로필의 flyway 설정이 server 아래에 있습니다", profile)
                    .isNull();
        }
    }
}
