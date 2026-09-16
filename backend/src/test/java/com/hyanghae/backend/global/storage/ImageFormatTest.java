package com.hyanghae.backend.global.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * 파일 내용으로 이미지 형식을 알아내는 규칙을 고정합니다.
 *
 * <p>이 판별이 뚫리면 이미지가 아닌 파일이 우리 도메인에서 내려갑니다. HTML 이 통과하면
 * 저장형 XSS 가 되므로, 통과해야 하는 것만큼 <b>막아야 하는 것</b>도 함께 확인합니다.
 */
class ImageFormatTest {

    @Test
    void detectsJpeg() {
        byte[] head = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};

        assertThat(ImageFormat.detect(head)).contains(ImageFormat.JPEG);
    }

    @Test
    void detectsPng() {
        byte[] head = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

        assertThat(ImageFormat.detect(head)).contains(ImageFormat.PNG);
    }

    @Test
    void detectsGif() {
        assertThat(ImageFormat.detect("GIF89a".getBytes(StandardCharsets.US_ASCII)))
                .contains(ImageFormat.GIF);
        assertThat(ImageFormat.detect("GIF87a".getBytes(StandardCharsets.US_ASCII)))
                .contains(ImageFormat.GIF);
    }

    @Test
    void detectsWebp() {
        assertThat(ImageFormat.detect(riff("WEBP"))).contains(ImageFormat.WEBP);
    }

    /**
     * WebP 는 RIFF 컨테이너를 씁니다. 앞 네 글자만 보면 WAV 같은 다른 RIFF 파일도 WebP 로
     * 통과하므로, 건너뛴 자리 뒤의 {@code WEBP} 까지 확인해야 합니다.
     */
    @Test
    void rejectsOtherRiffContainers() {
        assertThat(ImageFormat.detect(riff("WAVE"))).isEmpty();
    }

    /**
     * 확장자와 {@code Content-Type} 은 보내는 쪽이 정하는 값이라 판별에 쓰지 않습니다.
     * 이름이 {@code .jpg} 여도 내용이 HTML 이면 걸러야 합니다.
     */
    @Test
    void rejectsHtmlDisguisedAsImage() {
        byte[] head = "<html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);

        assertThat(ImageFormat.detect(head)).isEmpty();
    }

    /**
     * SVG 는 스크립트를 품을 수 있는 XML 이라 일부러 받지 않습니다.
     */
    @Test
    void rejectsSvg() {
        byte[] head = "<svg xmlns=\"http://www.w3.org/2000/svg\">".getBytes(StandardCharsets.UTF_8);

        assertThat(ImageFormat.detect(head)).isEmpty();
    }

    /**
     * 시그니처보다 짧은 파일은 어느 형식과도 맞지 않습니다. 길이를 확인하지 않으면 배열
     * 범위를 넘습니다.
     */
    @Test
    void rejectsTooShortContent() {
        assertThat(ImageFormat.detect(new byte[]{(byte) 0xFF})).isEmpty();
        assertThat(ImageFormat.detect(new byte[0])).isEmpty();
    }

    private byte[] riff(String type) {
        byte[] head = new byte[12];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, head, 0, 4);
        head[4] = 0x20;
        System.arraycopy(type.getBytes(StandardCharsets.US_ASCII), 0, head, 8, 4);
        return head;
    }
}
