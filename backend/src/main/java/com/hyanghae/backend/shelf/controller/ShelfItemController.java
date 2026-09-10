package com.hyanghae.backend.shelf.controller;

import com.hyanghae.backend.shelf.dto.request.FitRatingRequest;
import com.hyanghae.backend.shelf.dto.request.OwnershipStatusRequest;
import com.hyanghae.backend.shelf.dto.request.RepresentativeRequest;
import com.hyanghae.backend.shelf.dto.request.ShelfItemCreateRequest;
import com.hyanghae.backend.shelf.dto.response.FitRatingResponse;
import com.hyanghae.backend.shelf.dto.response.OwnershipStatusResponse;
import com.hyanghae.backend.shelf.dto.response.RepresentativeResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemCreateResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemDetailResponse;
import com.hyanghae.backend.shelf.dto.response.ShelfItemsResponse;
import com.hyanghae.backend.shelf.entity.OwnershipStatus;
import com.hyanghae.backend.shelf.service.FitRatingService;
import com.hyanghae.backend.shelf.service.OwnershipStatusService;
import com.hyanghae.backend.shelf.service.RepresentativePerfumeService;
import com.hyanghae.backend.shelf.service.ShelfItemService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "진열대 항목", description = "사용자의 진열대 항목을 관리합니다.")
@RestController
@RequestMapping("/api/v1/users/me/shelf-items")
public class ShelfItemController {

    private static final int DEFAULT_PAGE_SIZE = 7;

    private final FitRatingService fitRatingService;
    private final OwnershipStatusService ownershipStatusService;
    private final RepresentativePerfumeService representativePerfumeService;
    private final ShelfItemService shelfItemService;

    public ShelfItemController(
            FitRatingService fitRatingService,
            OwnershipStatusService ownershipStatusService,
            RepresentativePerfumeService representativePerfumeService,
            ShelfItemService shelfItemService
    ) {
        this.fitRatingService = fitRatingService;
        this.ownershipStatusService = ownershipStatusService;
        this.representativePerfumeService = representativePerfumeService;
        this.shelfItemService = shelfItemService;
    }

    @Operation(
            summary = "진열대에 향수 저장",
            description = "보유 상태를 생략하면 보유 희망(WISH)으로 저장합니다."
    )
    @ApiResponse(responseCode = "201", description = "저장 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "향수 없음")
    @ApiResponse(responseCode = "409", description = "이미 저장된 향수")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ShelfItemCreateResponse createShelfItem(
            @Valid @RequestBody ShelfItemCreateRequest request
    ) {
        return shelfItemService.create(request.perfumeId(), request.ownershipStatus());
    }

    @Operation(
            summary = "내 진열대 조회",
            description = "선택한 진열대 분류의 향수를 페이지 단위로 조회합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "400", description = "분류 누락 또는 올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @GetMapping
    public ShelfItemsResponse getMyShelfItems(
            @Parameter(
                    description = "조회할 진열대 분류",
                    required = true,
                    schema = @Schema(allowableValues = {"OWNED", "TRIED", "WISH"})
            )
            @RequestParam OwnershipStatus category,
            @Parameter(description = "페이지 번호. 0부터 시작합니다.", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "페이지 크기. 기본 7개, 최대 100개입니다.", example = "7")
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
    ) {
        return shelfItemService.findMine(category, page, size);
    }

    @Operation(
            summary = "진열대 향수 상세 조회",
            description = "선택한 진열대 항목의 향수 정보와 적합도, 향조, 개인 메모를 조회합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @GetMapping("/{shelfItemId}")
    public ShelfItemDetailResponse getMyShelfItem(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId
    ) {
        return shelfItemService.findMine(shelfItemId);
    }

    @Operation(
            summary = "진열대에서 향수 삭제",
            description = "진열대 항목과 연결된 시향 기록·컬렉션 연결을 함께 삭제합니다."
    )
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @DeleteMapping("/{shelfItemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteShelfItem(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId
    ) {
        shelfItemService.delete(shelfItemId);
    }

    @Operation(summary = "취향 적합도 등록·수정")
    @ApiResponse(responseCode = "200", description = "등록·수정 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 취향 적합도")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PutMapping("/{shelfItemId}/fit-rating")
    public FitRatingResponse updateFitRating(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId,
            @Valid @RequestBody FitRatingRequest request
    ) {
        return fitRatingService.update(shelfItemId, request.fitRating());
    }

    @Operation(summary = "취향 적합도 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @DeleteMapping("/{shelfItemId}/fit-rating")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFitRating(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId
    ) {
        fitRatingService.delete(shelfItemId);
    }

    @Operation(
            summary = "대표 향수 지정·해제",
            description = "true이면 기존 대표 향수를 해제하고 선택한 보유 향수를 대표로 지정합니다. "
                    + "false이면 선택한 향수의 대표 지정을 해제합니다."
    )
    @ApiResponse(responseCode = "200", description = "대표 향수 변경 성공")
    @ApiResponse(responseCode = "400", description = "대표로 지정할 수 없는 진열대 항목")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PatchMapping("/{shelfItemId}/representative")
    public RepresentativeResponse updateRepresentative(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId,
            @Valid @RequestBody RepresentativeRequest request
    ) {
        return representativePerfumeService.update(
                shelfItemId,
                request.representative()
        );
    }

    @Operation(
            summary = "향수 보유 상태 변경",
            description = "보유 중, 시향해 봄, 보유 희망 중 하나로 변경합니다. "
                    + "대표 향수를 보유 중 외 상태로 변경하면 대표 지정도 해제됩니다."
    )
    @ApiResponse(responseCode = "200", description = "보유 상태 변경 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 보유 상태")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PatchMapping("/{shelfItemId}/ownership")
    public OwnershipStatusResponse updateOwnershipStatus(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId,
            @Valid @RequestBody OwnershipStatusRequest request
    ) {
        return ownershipStatusService.update(
                shelfItemId,
                request.ownershipStatus()
        );
    }
}
