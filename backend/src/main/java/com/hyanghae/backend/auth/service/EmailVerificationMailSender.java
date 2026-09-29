package com.hyanghae.backend.auth.service;

/**
 * 인증번호 메일을 보냅니다. 보내지 못하면 {@link org.springframework.mail.MailException} 을 던집니다.
 *
 * <p>인터페이스로 둔 것은 통합 테스트가 실제 SMTP 없이 보낸 번호를 읽어야 하기 때문입니다.
 */
public interface EmailVerificationMailSender {

    void send(String email, String code);
}
