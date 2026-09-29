package com.hyanghae.backend.auth.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.auth.config.EmailVerificationProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class JavaMailEmailVerificationMailSenderTest {

    private final EmailVerificationProperties properties = new EmailVerificationProperties(
            Duration.ofMinutes(5), Duration.ofSeconds(60), 5, 5, Duration.ofMinutes(30),
            "no-reply@hyanghae.local");

    /** 운영에서 MAIL_HOST 를 빠뜨리면 뜨기는 하고 가입만 전부 막히므로, 시작 시점에 드러나야 합니다. */
    @Test
    void failsAtStartupWhenHostIsBlank() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("");

        assertThatThrownBy(() -> new JavaMailEmailVerificationMailSender(sender, properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("MAIL_HOST");
    }

    @Test
    void failsAtStartupWhenSmtpAuthIsOnWithoutUsername() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("smtp.example.com");
        sender.getJavaMailProperties().setProperty("mail.smtp.auth", "true");

        assertThatThrownBy(() -> new JavaMailEmailVerificationMailSender(sender, properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("MAIL_USERNAME");
    }

    /** 로컬 Mailpit 설정(인증 없음)은 그대로 떠야 합니다. */
    @Test
    void startsWithLocalMailpitSettings() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("localhost");
        sender.setPort(1025);
        sender.getJavaMailProperties().setProperty("mail.smtp.auth", "false");

        assertThatCode(() -> new JavaMailEmailVerificationMailSender(sender, properties))
                .doesNotThrowAnyException();
    }
}
