package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.auth.config.EmailVerificationProperties;
import com.hyanghae.backend.global.i18n.Language;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class JavaMailEmailVerificationMailSender implements EmailVerificationMailSender {

    private static final String SUBJECT_KO = "[향해] 이메일 인증번호";
    private static final String SUBJECT_EN = "[Hyanghae] Your verification code";

    private final JavaMailSender mailSender;
    private final EmailVerificationProperties properties;

    public JavaMailEmailVerificationMailSender(
            JavaMailSender mailSender,
            EmailVerificationProperties properties
    ) {
        requireUsableSmtp(mailSender);
        this.mailSender = mailSender;
        this.properties = properties;
    }

    /**
     * 메일 서버 설정이 비어 있으면 시작 시점에 실패시킵니다.
     *
     * <p>그대로 띄우면 애플리케이션은 멀쩡히 뜨고, 인증 요청마다 503 이 나가 아무도 가입하지 못합니다.
     * 배포 직후 헬스 체크로는 드러나지 않으므로(메일 헬스는 꺼 둠) 여기서 막습니다.
     */
    private static void requireUsableSmtp(JavaMailSender mailSender) {
        if (!(mailSender instanceof JavaMailSenderImpl impl)) {
            return;
        }
        if (!StringUtils.hasText(impl.getHost())) {
            throw new IllegalStateException(
                    "spring.mail.host 가 비어 있습니다. MAIL_HOST 를 설정하세요.");
        }
        boolean smtpAuth = Boolean.parseBoolean(
                impl.getJavaMailProperties().getProperty("mail.smtp.auth"));
        if (smtpAuth && !StringUtils.hasText(impl.getUsername())) {
            throw new IllegalStateException(
                    "SMTP 인증이 켜져 있는데 spring.mail.username 이 비어 있습니다. MAIL_USERNAME 을 설정하세요.");
        }
    }

    @Override
    public void send(String email, String code, Language language) {
        boolean english = language != null && language.isEnglish();
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from());
        message.setTo(email);
        message.setSubject(english ? SUBJECT_EN : SUBJECT_KO);
        message.setText(english ? englishBody(code) : koreanBody(code));
        mailSender.send(message);
    }

    private String koreanBody(String code) {
        return """
                향해 회원가입 이메일 인증번호입니다.

                인증번호: %s

                이 번호는 %d분 동안 유효합니다. 회원가입 화면에 입력해 주세요.
                직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다.
                """.formatted(code, properties.codeTtl().toMinutes());
    }

    private String englishBody(String code) {
        return """
                Here is your Hyanghae sign-up verification code.

                Verification code: %s

                This code is valid for %d minutes. Please enter it on the sign-up screen.
                If you didn't request this, you can safely ignore this email.
                """.formatted(code, properties.codeTtl().toMinutes());
    }
}
