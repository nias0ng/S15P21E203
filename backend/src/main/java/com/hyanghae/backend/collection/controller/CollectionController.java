package com.hyanghae.backend.collection.controller;

import com.hyanghae.backend.collection.dto.request.CollectionCreateRequest;
import com.hyanghae.backend.collection.dto.request.CollectionPerfumeCreateRequest;
import com.hyanghae.backend.collection.dto.request.CollectionUpdateRequest;
import com.hyanghae.backend.collection.dto.response.CollectionCreateResponse;
import com.hyanghae.backend.collection.dto.response.CollectionDetailResponse;
import com.hyanghae.backend.collection.dto.response.CollectionPerfumeCreateResponse;
import com.hyanghae.backend.collection.dto.response.CollectionsResponse;
import com.hyanghae.backend.collection.dto.response.CollectionUpdateResponse;
import com.hyanghae.backend.collection.service.CollectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "컬렉션", description = "내 진열대 향수로 구성한 컬렉션을 관리합니다.")
@RestController
@RequestMapping("/api/v1/users/me/collections")
public class CollectionController {

    private static final int DEFAULT_PAGE_SIZE = 10;

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @Operation(
            summary = "컬렉션 생성",
            description = "하나 이상의 내 진열대 향수로 컬렉션을 생성합니다."
    )
    @ApiResponse(responseCode = "201", description = "생성 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @ApiResponse(responseCode = "409", description = "컬렉션 이름 중복")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionCreateResponse createCollection(
            @Valid @RequestBody CollectionCreateRequest request
    ) {
        return collectionService.create(request);
    }

    @Operation(
            summary = "컬렉션에 향수 추가",
            description = "내 진열대에 저장된 향수를 컬렉션의 마지막 순서에 추가합니다."
    )
    @ApiResponse(responseCode = "201", description = "추가 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "컬렉션 또는 진열대 항목 없음")
    @ApiResponse(responseCode = "409", description = "컬렉션에 이미 추가된 향수")
    @PostMapping("/{collectionId}/perfumes")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionPerfumeCreateResponse addCollectionPerfume(
            @Parameter(
                    name = "collectionId",
                    description = "컬렉션 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long collectionId,
            @Valid @RequestBody CollectionPerfumeCreateRequest request
    ) {
        return collectionService.addPerfume(collectionId, request.shelfItemId());
    }

    @Operation(
            summary = "컬렉션에서 향수 제거",
            description = "컬렉션에서 향수 연결만 제거하며 진열대 향수는 유지합니다."
    )
    @ApiResponse(responseCode = "204", description = "제거 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "컬렉션 또는 컬렉션 향수 없음")
    @ApiResponse(responseCode = "409", description = "마지막 향수는 제거 불가")
    @DeleteMapping("/{collectionId}/perfumes/{shelfItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCollectionPerfume(
            @Parameter(
                    name = "collectionId",
                    description = "컬렉션 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long collectionId,
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId
    ) {
        collectionService.removePerfume(collectionId, shelfItemId);
    }

    @Operation(summary = "내 컬렉션 목록 조회")
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @GetMapping
    public CollectionsResponse getMyCollections(
            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기. 기본 10개, 최대 100개입니다.", example = "10")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return collectionService.findMine(page, size);
    }

    @Operation(
            summary = "내 컬렉션 상세 조회",
            description = "컬렉션 정보와 포함된 진열대 향수 목록을 조회합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "컬렉션 없음")
    @GetMapping("/{collectionId}")
    public CollectionDetailResponse getMyCollection(
            @Parameter(
                    name = "collectionId",
                    description = "컬렉션 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long collectionId
    ) {
        return collectionService.findMine(collectionId);
    }

    @Operation(summary = "컬렉션 수정", description = "컬렉션 이름 또는 설명을 수정합니다.")
    @ApiResponse(responseCode = "200", description = "수정 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "컬렉션 없음")
    @ApiResponse(responseCode = "409", description = "컬렉션 이름 중복")
    @PatchMapping("/{collectionId}")
    public CollectionUpdateResponse updateCollection(
            @Parameter(
                    name = "collectionId",
                    description = "컬렉션 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long collectionId,
            @Valid @RequestBody CollectionUpdateRequest request
    ) {
        return collectionService.update(collectionId, request);
    }

    @Operation(
            summary = "컬렉션 삭제",
            description = "컬렉션과 향수 연결을 삭제하며 진열대 향수는 유지합니다."
    )
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "컬렉션 없음")
    @DeleteMapping("/{collectionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCollection(
            @Parameter(
                    name = "collectionId",
                    description = "컬렉션 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long collectionId
    ) {
        collectionService.delete(collectionId);
    }
}
