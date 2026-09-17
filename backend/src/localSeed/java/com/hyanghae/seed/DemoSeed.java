package com.hyanghae.seed;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** 발표 화면에 필요한 사용자 활동 데이터를 운영 DB에 명시적으로 한 번 보충하는 도구입니다. */
public final class DemoSeed {
    private DemoSeed() {}

    public static void main(String[] args) throws Exception {
        if (!"CREATE_DEMO_DATA".equals(System.getenv("DEMO_SEED_CONFIRM"))) {
            throw new IllegalArgumentException("DEMO_SEED_CONFIRM=CREATE_DEMO_DATA 확인값이 필요합니다.");
        }
        String mode = System.getenv().getOrDefault("SEED_MODE", "fill");
        if (!"fill".equals(mode)) {
            throw new IllegalArgumentException("운영 데모 seed는 SEED_MODE=fill만 허용합니다.");
        }
        String url = required("SEED_JDBC_URL");
        String user = required("SEED_DB_USER");
        String dbPassword = required("SEED_DB_PASSWORD");
        String loginPassword = required("SEED_LOGIN_PASSWORD");
        if (loginPassword.length() < 8 || loginPassword.length() > 64
                || loginPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("데모 계정 비밀번호는 8~64자, UTF-8 기준 72바이트 이하로 지정하세요.");
        }
        Path data = Path.of(System.getenv().getOrDefault("SEED_DATA_DIR", "db/seed"));
        LocalSeed.runDemo(url, user, dbPassword, data,
                new BCryptPasswordEncoder().encode(loginPassword));
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " 환경변수가 필요합니다.");
        }
        return value;
    }
}
