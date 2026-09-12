package com.hyanghae.backend.community.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
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
 * <p>{@code perfumeIds}·{@code imageUrls} 는 보낸 목록으로 통째로 바뀝니다. 빈 배열을 보내면
 * 연결을 모두 지웁니다. 일부만 더하거나 빼는 방법은 두지 않았습니다. 화면이 목록 전체를 들고
 * 있어서 그대로 보내면 되고, 부분 수정은 순서까지 맞추기 어렵습니다.
 */
public class PostUpdateRequest {

    private Long categoryId;
    private String title;
    private String content;
    private List<Long> perfumeIds;
    private List<String> imageUrls;

    private boolean categoryPresent;
    private boolean titlePresent;
    private boolean contentPresent;
    private boolean perfumesPresent;
    private boolean imagesPresent;

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
        this.categoryPresent = true;
    }

    public void setTitle(String title) {
        this.title = title;
        this.titlePresent = true;
    }

    public void setContent(String content) {
        this.content = content;
        this.contentPresent = true;
    }

    public void setPerfumeIds(List<Long> perfumeIds) {
        this.perfumeIds = perfumeIds;
        this.perfumesPresent = true;
    }

    public void setImageUrls(List<String> imageUrls) {
        this.imageUrls = imageUrls;
        this.imagesPresent = true;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    @Size(max = 50, message = "제목은 50자까지 쓸 수 있습니다.")
    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public List<Long> getPerfumeIds() {
        return perfumeIds;
    }

    public List<String> getImageUrls() {
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
                || perfumesPresent || imagesPresent;
        boolean keepsRequiredValues = (!categoryPresent || categoryId != null)
                && (!titlePresent || (title != null && !title.isBlank()))
                && (!contentPresent || (content != null && !content.isBlank()))
                && (!perfumesPresent || perfumeIds != null)
                && (!imagesPresent || imageUrls != null);

        return hasSomething && keepsRequiredValues;
    }
}
