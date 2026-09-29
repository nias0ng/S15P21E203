package com.hyanghae.backend.support;

import com.hyanghae.backend.auth.service.EmailVerificationMailSender;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.mail.MailSendException;

/**
 * 실제 SMTP 대신 보낸 메일을 모아 둡니다. 테스트는 여기서 인증번호를 꺼내 확인 API 에 넣습니다.
 *
 * <p>여러 테스트 클래스가 스프링 컨텍스트를 나눠 쓰므로 이 빈도 공유됩니다. 번호는 받는 사람으로
 * 골라 꺼내 앞선 테스트가 남긴 메일과 섞이지 않게 합니다.
 */
public class FakeEmailVerificationMailSender implements EmailVerificationMailSender {

    private final List<SentMail> sent = new CopyOnWriteArrayList<>();
    private final AtomicBoolean failNext = new AtomicBoolean();

    @Override
    public void send(String email, String code) {
        if (failNext.getAndSet(false)) {
            throw new MailSendException("fake mail server is down");
        }
        sent.add(new SentMail(email, code));
    }

    /** 다음 한 번의 전송을 메일 서버 오류로 실패시킵니다. */
    public void failNextSend() {
        failNext.set(true);
    }

    public String lastCodeFor(String email) {
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return sent.reversed().stream()
                .filter(mail -> mail.to().equals(normalized))
                .map(SentMail::code)
                .findFirst()
                .orElseThrow(() -> new AssertionError("no verification mail was sent"));
    }

    public List<SentMail> sentTo(String email) {
        return sent.stream().filter(mail -> mail.to().equals(email)).toList();
    }

    public void clear() {
        sent.clear();
        failNext.set(false);
    }

    public record SentMail(String to, String code) {
    }
}
