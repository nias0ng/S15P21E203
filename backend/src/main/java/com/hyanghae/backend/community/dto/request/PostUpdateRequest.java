package com.hyanghae.backend.community.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 게시글 수정 요청입니다. 보낸 항목만 바뀌고 나머지는 그대로 둡니다.
 *
 * <p><b>레코드가 아니라 클래스인 이유가 있습니다.</b> "보내지 않음" 과 "비우라고 보냄" 을 구분해야
 * 합니다. 레코드로 받으면 둘 다 {@code null} 이라 향수 연결을 지우라는 요청과 건드리지 말라는
 * 요청이 같아집니다. Jackson 이 설정자를 부를 때만 표시를 남겨 그 둘을 가릅니다.
 *
 * <p>컬렉션 도메인의 수정 요청이 같은 방식을 씁니다.
 *
 * <p>{@code collectionId} 는 {@code null} 을 보내면 첨부를 뗍니다. 분류·제목·내용과 달리 글이
 * 반드시 갖는 값이 아니라 비울 수 있습니다.
 *
 * <p><b>{@code collectionId} 를 보낼 때만 컬렉션을 다시 읽습니다.</b> 보내지 않으면 글을 쓸 때
 * 박제한 이름과 향수가 그대로 남습니다. 제목만 고쳤는데 향수가 바뀌어 있으면 안 되기 때문입니다.
 * 지금의 컬렉션으로 맞추고 싶으면 같은 번호를 다시 보내면 됩니다.
 *
 * <p>컬렉션이 붙어 있는 글에는 {@code perfumeIds} 를 보낼 수 없습니다(400). 향수 출처가
 * 컬렉션이기 때문입니다. 목록을 직접 정하려면 같은 요청에서 {@code collectionId} 를
 * {@code null} 로 보내 컬렉션을 먼저 떼야 합니다.
 *
 * <p>{@code perfumeIds}·{@code imageUrls} 는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면
 * 연결을 모두 지웁니다. 일부만 더하거나 빼는 방법은 두지 않았습니다. 화면이 목록 전체를 들고
 * 있어서 그대로 보내면 되고, 부분 수정은 순서까지 맞추기 어렵습니다.
 */
public class PostUpdateRequest {

    private String category;
    private String title;
    private String content;
    private Long collectionId;
    private List<Long> perfumeIds;
    private List<String> imageUrls;

    private boolean categoryPresent;
    private boolean titlePresent;
    private boolean contentPresent;
    private boolean collectionPresent;
    private boolean perfumesPresent;
    private boolean imagesPresent;

    public void setCategory(String category) {
        this.category = category == null ? null : category.strip();
        this.categoryPresent = true;
    }

    public void setTitle(String title) {
        this.title = title == null ? null : title.strip();
        this.titlePresent = true;
    }

    public void setContent(String content) {
        this.content = content == null ? null : content.strip();
        this.contentPresent = true;
    }

    public void setCollectionId(Long collectionId) {
        this.collectionId = collectionId;
        this.collectionPresent = true;
    }

    public void setPerfumeIds(List<Long> perfumeIds) {
        this.perfumeIds = perfumeIds;
        this.perfumesPresent = true;
    }

    public void setImageUrls(List<String> imageUrls) {
        this.imageUrls = imageUrls;
        this.imagesPresent = true;
    }

    @Schema(description = "바꿀 분류 코드. 생략하면 유지", example = "CHAT",
            allowableValues = {"COLLECTION", "RECOMMEND", "CHAT"})
    public String getCategory() {
        return category;
    }

    @Schema(description = "바꿀 제목. 생략하면 유지", maxLength = 50)
    @Size(max = 50, message = "제목은 50자까지 쓸 수 있습니다.")
    public String getTitle() {
        return title;
    }

    @Schema(description = "바꿀 내용. 생략하면 유지")
    public String getContent() {
        return content;
    }

    @Schema(description = "바꿀 컬렉션 ID. 생략하면 유지하고 null 을 보내면 첨부를 뗍니다.",
            nullable = true)
    public Long getCollectionId() {
        return collectionId;
    }

    @JsonIgnore
    public boolean isCollectionPresent() {
        return collectionPresent;
    }

    @Schema(description = "바꿀 향수 ID 목록. 통째로 교체되고 빈 배열이면 모두 지웁니다. 생략하면 유지")
    public List<@NotNull @Positive Long> getPerfumeIds() {
        return perfumeIds;
    }

    @Schema(description = "바꿀 이미지 주소 목록. 통째로 교체되고 빈 배열이면 모두 지웁니다. 생략하면 유지")
    public List<@NotBlank String> getImageUrls() {
        return imageUrls;
    }

    @JsonIgnore
    public boolean isCategoryPresent() {
        return categoryPresent;
    }

    @JsonIgnore
    public boolean isTitlePresent() {
        return titlePresent;
    }

    @JsonIgnore
    public boolean isContentPresent() {
        return contentPresent;
    }

    @JsonIgnore
    public boolean isPerfumesPresent() {
        return perfumesPresent;
    }

    @JsonIgnore
    public boolean isImagesPresent() {
        return imagesPresent;
    }

    /**
     * 고칠 것이 하나는 있어야 하고, 보낸 값은 비어 있으면 안 됩니다.
     *
     * <p>분류·제목·내용은 글이 반드시 갖는 값이라 비우라고 보낼 수 없습니다. 향수와 이미지는 빈
     * 배열로 연결을 지울 수 있지만 {@code null} 은 받지 않습니다. 지우려는 것인지 실수인지
     * 구분되지 않기 때문입니다.
     */
    @JsonIgnore
    @AssertTrue(message = "고칠 항목이 필요하며 분류·제목·내용은 비울 수 없습니다.")
    public boolean isValidPatch() {
        boolean hasSomething = categoryPresent || titlePresent || contentPresent
                || collectionPresent || perfumesPresent || imagesPresent;
        boolean keepsRequiredValues = (!categoryPresent || (category != null && !category.isBlank()))
                && (!titlePresent || (title != null && !title.isBlank()))
                && (!contentPresent || (content != null && !content.isBlank()))
                && (!perfumesPresent || perfumeIds != null)
                && (!imagesPresent || imageUrls != null);

        return hasSomething && keepsRequiredValues;
    }
}
