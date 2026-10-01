package com.hyanghae.backend.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hyanghae.backend.auth.config.EmailVerificationProperties;
import com.hyanghae.backend.global.i18n.Language;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
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

    /** 한국어 요청에는 지금까지와 같은 한국어 메일이 나갑니다. */
    @Test
    void sendsKoreanMailForKoreanRequest() {
        CapturingMailSender sender = new CapturingMailSender();

        new JavaMailEmailVerificationMailSender(sender, properties)
                .send("sailor@example.com", "1234567", Language.KO);

        SimpleMailMessage message = sender.onlyMessage();
        assertThat(message.getTo()).containsExactly("sailor@example.com");
        assertThat(message.getFrom()).isEqualTo("no-reply@hyanghae.local");
        assertThat(message.getSubject()).isEqualTo("[향해] 이메일 인증번호");
        assertThat(message.getText())
                .contains("인증번호: 1234567")
                .contains("5분 동안 유효합니다")
                .contains("직접 요청하지 않았다면");
    }

    @Test
    void sendsEnglishMailForEnglishRequest() {
        CapturingMailSender sender = new CapturingMailSender();

        new JavaMailEmailVerificationMailSender(sender, properties)
                .send("sailor@example.com", "1234567", Language.EN);

        SimpleMailMessage message = sender.onlyMessage();
        assertThat(message.getSubject()).isEqualTo("[Hyanghae] Your verification code");
        assertThat(message.getText())
                .contains("Verification code: 1234567")
                .contains("valid for 5 minutes")
                .contains("If you didn't request this")
                .doesNotContain("인증번호");
    }

    /** 언어를 모르면 한국어가 기본입니다. */
    @Test
    void fallsBackToKoreanWithoutLanguage() {
        CapturingMailSender sender = new CapturingMailSender();

        new JavaMailEmailVerificationMailSender(sender, properties)
                .send("sailor@example.com", "1234567", null);

        assertThat(sender.onlyMessage().getSubject()).isEqualTo("[향해] 이메일 인증번호");
    }

    /** 실제 SMTP 로 나가지 않고 보낸 메시지를 모읍니다. */
    private static final class CapturingMailSender extends JavaMailSenderImpl {

        private final List<SimpleMailMessage> sent = new ArrayList<>();

        CapturingMailSender() {
            setHost("localhost");
        }

        @Override
        public void send(SimpleMailMessage... simpleMessages) {
            sent.addAll(List.of(simpleMessages));
        }

        SimpleMailMessage onlyMessage() {
            assertThat(sent).hasSize(1);
            return sent.getFirst();
        }
    }
}
