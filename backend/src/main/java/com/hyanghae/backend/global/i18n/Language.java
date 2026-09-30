package com.hyanghae.backend.global.i18n;

import java.util.Locale;
import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 응답 데이터의 언어입니다. 화면이 요청마다 {@code Accept-Language} 로 {@code ko} 또는 {@code en} 을 보냅니다.
 *
 * <p>한국어가 기본입니다. 영어로 시작하는 언어 태그만 영어로 보고, 헤더가 없거나 다른 언어면 한국어입니다.
 * 영어 데이터가 비어 있는 곳은 부르는 쪽이 한국어로 되돌아갑니다.
 */
public enum Language {
    KO,
    EN;

    /**
     * 지금 요청의 언어입니다. 요청 밖(배치 · 스케줄러)에서는 한국어입니다.
     *
     * <p>{@link LocaleContextHolder#getLocale()} 만 보면 안 됩니다. 헤더가 없는 요청에서 기본
     * LocaleResolver 는 서버 JVM 의 기본 로케일(보통 영어)을 돌려주고, 요청 밖에서도 JVM 기본
     * 로케일로 떨어집니다. 그러면 헤더 없는 요청과 배치가 영어가 됩니다. 그래서 헤더가 없는 요청과
     * 로케일 문맥이 없는 곳은 여기서 한국어로 정합니다.
     */
    public static Language current() {
        if (isRequestWithoutLanguageHeader()) {
            return KO;
        }
        LocaleContext context = LocaleContextHolder.getLocaleContext();
        return context == null ? KO : of(context.getLocale());
    }

    public static Language of(Locale locale) {
        if (locale == null) {
            return KO;
        }
        return "en".equalsIgnoreCase(locale.getLanguage()) ? EN : KO;
    }

    public boolean isEnglish() {
        return this == EN;
    }

    private static boolean isRequestWithoutLanguageHeader() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servletAttributes)) {
            return false;
        }
        String header = servletAttributes.getRequest().getHeader(HttpHeaders.ACCEPT_LANGUAGE);
        return header == null || header.isBlank();
    }
}
