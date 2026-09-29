-- Google 로 가입하고 로그인할 수 있게 합니다.
--
-- google_subject 는 Google ID 토큰의 sub 입니다. Google 계정마다 바뀌지 않는 식별자라 이것으로
-- 사람을 찾습니다. 이메일로 찾지 않는 이유는 Google 계정의 이메일이 바뀔 수 있기 때문입니다.
--
-- 별도 테이블이 아니라 컬럼입니다. 지금 붙이는 로그인 수단이 Google 하나이고, 한 사람에게 Google
-- 계정도 하나입니다. 두 번째 수단이 생기면 그때 테이블로 옮깁니다.
ALTER TABLE users
    ADD COLUMN google_subject VARCHAR(255),
    ADD CONSTRAINT uk_users_google_subject UNIQUE (google_subject);

-- Google 로 가입한 사람은 비밀번호가 없습니다.
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- 둘 다 없으면 그 계정으로 로그인할 방법이 없습니다.
ALTER TABLE users
    ADD CONSTRAINT ck_users_has_login_method
        CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL);
