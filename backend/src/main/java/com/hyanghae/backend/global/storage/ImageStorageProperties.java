package com.hyanghae.backend.global.storage;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 이미지를 어디에 쌓을지 정하는 공용 설정입니다. 도메인별 설정(크기 제한 · 경로)은 각 도메인에
 * 있고, 여기는 <b>뒷단이 무엇이냐</b>만 담습니다.
 *
 * @param s3 S3 저장소 설정입니다. {@code enabled} 가 거짓이면 나머지는 쓰이지 않습니다.
 */
@Validated
@ConfigurationProperties(prefix = "hyanghae.storage")
public record ImageStorageProperties(@DefaultValue @NotNull S3 s3) {

    /**
     * S3 저장소 설정입니다.
     *
     * <p><b>기본값이 꺼짐입니다.</b> 켜려면 버킷과 CloudFront 주소가 있어야 하고, 그것은
     * 배포 환경에만 있습니다. 로컬 개발과 테스트는 AWS 없이 돌아야 하므로 꺼진 채로 두고
     * 서버 디스크를 씁니다.
     *
     * <p>자격 증명은 여기서 받지 않습니다. AWS SDK 의 기본 탐색 순서(환경변수 · EC2 인스턴스
     * 역할 등)를 그대로 씁니다. 키를 설정 파일로 받으면 저장소에 커밋될 길이 생깁니다.
     *
     * @param enabled       켜면 S3 에 쌓고, 끄면 서버 디스크에 쌓습니다.
     * @param bucket        버킷 이름입니다. 카탈로그 이미지와 같은 버킷을 씁니다.
     * @param region        버킷 리전입니다(예: {@code ap-northeast-2}).
     * @param keyPrefix     <b>환경을 나누는 프리픽스</b>입니다(예: {@code prod} · {@code dev}).
     *                      한 버킷을 개발과 운영이 나눠 쓰므로, 이것이 비면 두 환경이 같은
     *                      경로에 섞어 씁니다 — 개발에서 테스트로 올린 사진이 운영 이미지
     *                      틈에 쌓이고, 지울 때 구분이 안 됩니다.
     *                      <p>도메인별 프리픽스({@code uploads/posts} 등) 앞에 붙습니다.
     *                      비워 두면 환경 구분 없이 도메인 프리픽스부터 시작합니다.
     * @param publicPathPrefix 주소에 나타나는 프리픽스입니다. <b>비워 두면
     *                      {@code keyPrefix} 와 같습니다.</b>
     *                      <p>둘을 나눠 둔 이유는 CloudFront 설정이 두 갈래이기 때문입니다.
     *                      배포가 버킷 뿌리를 가리키면 주소에도 프리픽스가 그대로 나와야
     *                      하고(기본값), 배포의 오리진 경로가 이미 프리픽스를 가리키면
     *                      주소에는 나오면 안 됩니다 — 그때 이 값을 빈 문자열이 아니라
     *                      {@code "-"} 처럼 <b>명시적으로 비움</b>을 뜻하는 값으로 둡니다.
     *                      아래 {@link #publicPathPrefixOrKeyPrefix()} 를 보십시오.
     * @param publicBaseUrl CloudFront 배포 주소입니다. <b>S3 객체 주소가 아닙니다</b> — 버킷은
     *                      CloudFront 만 읽을 수 있게 잠겨 있어, S3 주소를 저장하면 사용자가
     *                      403 을 받습니다.
     * @param endpointOverride S3 주소를 직접 지정합니다. <b>테스트에서 LocalStack 을
     *                      가리키는 용도</b>이고 운영에서는 비워 둡니다. 비어 있으면 SDK 가
     *                      리전에 맞는 실제 S3 주소를 씁니다.
     * @param cacheControl  객체에 붙일 캐시 헤더입니다. 파일 이름이 UUID 라 같은 주소의 내용이
     *                      바뀌지 않으므로 길게 잡아도 안전합니다. 사진을 바꾸면 새 주소가
     *                      나오니 무효화도 필요 없습니다.
     */
    public record S3(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("") String bucket,
            @DefaultValue("") String region,
            @DefaultValue("") String publicBaseUrl,
            @DefaultValue("") String keyPrefix,
            @DefaultValue("") String publicPathPrefix,
            @DefaultValue("") String endpointOverride,
            @DefaultValue("public, max-age=2592000") @NotBlank String cacheControl
    ) {

        /**
         * 켜 두고 값을 안 채우면 시작할 때 실패합니다.
         *
         * <p>첫 업로드에서 500 을 보고 알아채는 것보다 배포 시점에 실패하는 편이 낫습니다.
         * 설정이 빈 것은 요청으로 고칠 수 있는 문제가 아닙니다.
         */
        /**
         * 주소에 쓸 프리픽스입니다. 비어 있으면 {@code keyPrefix} 를 그대로 씁니다.
         *
         * <p>CloudFront 오리진 경로가 이미 프리픽스를 가리켜 주소에는 빼야 하는 경우,
         * {@code publicPathPrefix} 를 {@code "-"} 로 두면 빈 값으로 봅니다. 설정 파일에서
         * "비어 있음"과 "지정하지 않음"을 구분할 방법이 달리 없습니다.
         */
        public String publicPathPrefixOrKeyPrefix() {
            if ("-".equals(publicPathPrefix)) {
                return "";
            }
            return publicPathPrefix.isBlank() ? keyPrefix : publicPathPrefix;
        }

        public S3 {
            if (enabled) {
                requireFilled(bucket, "hyanghae.storage.s3.bucket");
                requireFilled(region, "hyanghae.storage.s3.region");
                requireFilled(publicBaseUrl, "hyanghae.storage.s3.public-base-url");
            }
        }

        private static void requireFilled(String value, String key) {
            if (value == null || value.isBlank()) {
                throw new IllegalStateException(key + " must be set when S3 storage is enabled");
            }
        }
    }
}
