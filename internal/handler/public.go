package handler

import (
	"illust-nest/internal/service"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type PublicHandler struct {
	workService *service.WorkService
}

func NewPublicHandler(workService *service.WorkService) *PublicHandler {
	return &PublicHandler{workService: workService}
}

func (h *PublicHandler) ListWorks(c *gin.Context) {
	page := 1
	if p := c.Query("page"); p != "" {
		if val, err := strconv.Atoi(p); err == nil && val > 0 {
			page = val
		}
	}

	pageSize := 20
	if ps := c.Query("page_size"); ps != "" {
		if val, err := strconv.Atoi(ps); err == nil && val > 0 && val <= 100 {
			pageSize = val
		}
	}

	ratingMin := -1
	if r := c.Query("rating_min"); r != "" {
		if val, err := strconv.Atoi(r); err == nil {
			ratingMin = val
		}
	}

	ratingMax := -1
	if r := c.Query("rating_max"); r != "" {
		if val, err := strconv.Atoi(r); err == nil {
			ratingMax = val
		}
	}

	var tagIDs []uint
	if t := c.Query("tag_ids"); t != "" {
		ids, err := h.workService.ParseTagIDs(t)
		if err == nil {
			tagIDs = ids
		}
	}

	params := &service.WorkListParams{
		Page:      page,
		PageSize:  pageSize,
		Keyword:   c.Query("keyword"),
		TagIDs:    tagIDs,
		RatingMin: ratingMin,
		RatingMax: ratingMax,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}

	result, err := h.workService.GetPublicWorks(params)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, result)
}

func (h *PublicHandler) GetWork(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	work, err := h.workService.GetPublicWorkByID(uint(id))
	if err != nil {
		NotFound(c)
		return
	}

	Success(c, work)
}

func (h *PublicHandler) GetOriginalImage(c *gin.Context) {
	h.servePublicImage(c, "uploads/originals", false)
}

func (h *PublicHandler) GetThumbnailImage(c *gin.Context) {
	h.servePublicImage(c, "uploads/thumbnails", true)
}

func (h *PublicHandler) GetTranscodedImage(c *gin.Context) {
	h.servePublicImage(c, "uploads/transcoded", false)
}

func (h *PublicHandler) servePublicImage(c *gin.Context, prefix string, isThumbnail bool) {
	rawPath := strings.TrimSpace(c.Param("filepath"))
	trimmed := strings.TrimPrefix(rawPath, "/")
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	relativePath := prefix + "/" + cleaned
	allowed, err := h.workService.IsPublicImagePath(relativePath, isThumbnail)
	if err != nil {
		InternalError(c)
		return
	}
	if !allowed {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	fullPathAbs, err := service.ResolveUploadPath(relativePath)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	fileInfo, err := os.Stat(fullPathAbs)
	if err != nil || fileInfo.IsDir() {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(fullPathAbs)
}
