package com.hyanghae.backend.community.service;

import java.util.Arrays;
import java.util.Optional;

/**
 * 올릴 수 있는 이미지 형식입니다.
 *
 * <p><b>파일 내용의 앞부분(시그니처)으로 판별합니다.</b> 브라우저가 보낸 {@code Content-Type}
 * 헤더나 파일 이름의 확장자는 요청을 만드는 쪽이 마음대로 적을 수 있는 값이라 믿을 수 없습니다.
 * 확장자만 보고 저장하면 {@code .png} 라고 적힌 HTML 파일이 그대로 들어오고, 그것을 우리
 * 도메인에서 내주는 순간 저장형 XSS 가 됩니다. 브라우저는 우리가 붙인 확장자를 보고 형식을
 * 정하므로, 확장자는 <b>내용에서 알아낸 형식</b>으로 우리가 붙여야 합니다.
 *
 * <p>SVG 는 일부러 넣지 않았습니다. SVG 는 그림이지만 스크립트를 품을 수 있는 XML 문서라
 * 같은 문제가 그대로 남습니다. 시그니처도 없어 내용으로 판별할 수도 없습니다.
 */
enum PostImageFormat {

    /** {@code FF D8 FF} 로 시작합니다. 뒤 한 바이트는 세그먼트 종류라 보지 않습니다. */
    JPEG("jpg", "image/jpeg", new int[]{0xFF, 0xD8, 0xFF}),

    /** {@code 89 P N G CR LF 1A LF} 입니다. 파일 전송 중 개행이 바뀌면 깨지도록 만든 머리말입니다. */
    PNG("png", "image/png", new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}),

    /** {@code GIF87a} 와 {@code GIF89a} 둘 다 있어 공통인 {@code GIF8} 까지만 봅니다. */
    GIF("gif", "image/gif", new int[]{0x47, 0x49, 0x46, 0x38}),

    /**
     * RIFF 컨테이너입니다. {@code RIFF} 다음 4바이트가 파일 길이라 건너뛰고 {@code WEBP} 를
     * 확인해야 합니다. 앞 네 글자만 보면 WAV 같은 다른 RIFF 파일도 통과합니다.
     */
    WEBP("webp", "image/webp", new int[]{0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50});

    /**
     * 형식을 알아내는 데 필요한 최대 바이트 수입니다. 파일 전체를 메모리에 올리지 않고
     * 이만큼만 읽어 판별합니다.
     */
    static final int SIGNATURE_LENGTH = Arrays.stream(values())
            .mapToInt(format -> format.signature.length)
            .max()
            .orElseThrow();

    private final String extension;
    private final String contentType;

    /** 값이 {@code -1} 인 자리는 무엇이 와도 되는 자리입니다. */
    private final int[] signature;

    PostImageFormat(String extension, String contentType, int[] signature) {
        this.extension = extension;
        this.contentType = contentType;
        this.signature = signature;
    }

    /**
     * 앞부분 바이트로 형식을 찾습니다. 아는 형식이 없으면 빈 값입니다.
     */
    static Optional<PostImageFormat> detect(byte[] head) {
        return Arrays.stream(values())
                .filter(format -> format.matches(head))
                .findFirst();
    }

    String extension() {
        return extension;
    }

    String contentType() {
        return contentType;
    }

    private boolean matches(byte[] head) {
        if (head.length < signature.length) {
            return false;
        }
        for (int index = 0; index < signature.length; index++) {
            if (signature[index] != -1 && (head[index] & 0xFF) != signature[index]) {
                return false;
            }
        }
        return true;
    }
}
