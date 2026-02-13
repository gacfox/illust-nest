package handler

import (
	"illust-nest/internal/service"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type TagHandler struct {
	tagService *service.TagService
}

func NewTagHandler(tagService *service.TagService) *TagHandler {
	return &TagHandler{tagService: tagService}
}

func (h *TagHandler) List(c *gin.Context) {
	keyword := c.Query("keyword")
	includeCount := c.DefaultQuery("include_count", "false") == "true"

	tags, err := h.tagService.GetTags(keyword, includeCount)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, gin.H{"items": tags})
}

func (h *TagHandler) Create(c *gin.Context) {
	var req service.CreateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	tag, err := h.tagService.CreateTag(&req)
	if err != nil {
		if ve, ok := err.(*service.ValidationError); ok {
			Error(c, ve.Code, ve.Message)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, tag)
}

func (h *TagHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid tag id")
		return
	}

	var req service.UpdateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	tag, err := h.tagService.UpdateTag(uint(id), &req)
	if err != nil {
		if strings.Contains(err.Error(), "tag not found") {
			NotFound(c)
		} else if strings.Contains(err.Error(), "cannot update") {
			Forbidden(c)
		} else if ve, ok := err.(*service.ValidationError); ok {
			Error(c, ve.Code, ve.Message)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, tag)
}

func (h *TagHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid tag id")
		return
	}

	if err := h.tagService.DeleteTag(uint(id)); err != nil {
		if strings.Contains(err.Error(), "tag not found") {
			NotFound(c)
		} else if strings.Contains(err.Error(), "cannot delete") {
			Forbidden(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

func (h *TagHandler) BatchCreate(c *gin.Context) {
	var req service.BatchCreateTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	resp, err := h.tagService.BatchCreateTags(&req)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, resp)
}
