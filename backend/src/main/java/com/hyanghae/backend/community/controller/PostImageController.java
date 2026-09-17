package com.hyanghae.backend.community.controller;

import com.hyanghae.backend.community.dto.response.PostImageUploadResponse;
import com.hyanghae.backend.community.service.PostImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 게시글에 붙일 이미지 파일을 올립니다.
 *
 * <p>글쓰기와 두 단계로 나뉩니다. 먼저 여기로 파일을 올려 주소를 받고, 그 주소를 글 작성·수정
 * API 의 {@code imageUrls} 에 담아 보냅니다. 글이 만들어지기 전에 미리보기를 보여줘야 해서
 * 한 번에 처리할 수 없습니다.
 *
 * <p>한 번에 한 장입니다. 여러 장은 화면이 이 API 를 여러 번 부릅니다. 그래야 한 장이 실패해도
 * 나머지가 살아남고, 어느 장이 실패했는지 화면이 압니다.
 *
 * <p>올린 파일을 내주는 것은 컨트롤러가 아니라 리소스 핸들러입니다
 * ({@code PostImageWebConfig}). 그래서 이 문서에는 올리는 쪽만 있습니다. 받은 주소로 GET 하면
 * 로그인 없이 이미지가 나옵니다.
 */
@Tag(name = "게시글 이미지", description = "게시글에 붙일 이미지 파일을 올립니다.")
@RestController
@RequestMapping("/api/v1/posts/images")
public class PostImageController {

    private final PostImageService postImageService;

    public PostImageController(PostImageService postImageService) {
        this.postImageService = postImageService;
    }

    /**
     * 이미지 한 장을 올리고 주소를 돌려받습니다.
     *
     * <p>파일 내용으로 형식을 확인합니다. 확장자를 {@code .jpg} 로 바꿔 보내도 내용이 이미지가
     * 아니면 415 입니다. 크기 제한을 넘기면 413 이고, 로그인하지 않았으면 401 입니다.
     */
    @Operation(
            summary = "게시글 이미지 업로드",
            description = "JPG · PNG · GIF · WEBP 만 받습니다. 형식은 파일 이름이 아니라 파일"
                    + " 내용으로 판별합니다. 기본 크기 제한은 한 장에 5MB 입니다. 응답의"
                    + " imageUrl 을 글 작성·수정 요청의 imageUrls 에 그대로 담아 보냅니다."
    )
    @ApiResponse(responseCode = "201", description = "업로드 성공")
    @ApiResponse(responseCode = "400", description = "파일을 보내지 않았거나 빈 파일")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "413", description = "크기 제한 초과")
    @ApiResponse(responseCode = "415", description = "허용하지 않는 형식")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostImageUploadResponse uploadImage(
            @Parameter(description = "올릴 이미지 파일", required = true)
            @RequestParam("file") MultipartFile file
    ) {
        return new PostImageUploadResponse(postImageService.save(file));
    }
}
