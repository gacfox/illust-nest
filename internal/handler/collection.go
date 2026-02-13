package handler

import (
	"illust-nest/internal/service"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type CollectionHandler struct {
	collectionService *service.CollectionService
}

func NewCollectionHandler(collectionService *service.CollectionService) *CollectionHandler {
	return &CollectionHandler{collectionService: collectionService}
}

func (h *CollectionHandler) Tree(c *gin.Context) {
	tree, err := h.collectionService.GetTree()
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, gin.H{"items": tree})
}

func (h *CollectionHandler) Get(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	collection, err := h.collectionService.GetCollection(uint(id))
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, collection)
}

func (h *CollectionHandler) GetWorks(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

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

	var isPublic *bool
	if p := c.Query("is_public"); p != "" {
		if val, err := strconv.ParseBool(p); err == nil {
			isPublic = &val
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
		ids, err := parseTagIDs(t)
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
		IsPublic:  isPublic,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}

	result, err := h.collectionService.GetCollectionWorks(uint(id), params)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, result)
}

func (h *CollectionHandler) Create(c *gin.Context) {
	var req service.CreateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	collection, err := h.collectionService.CreateCollection(&req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else if strings.Contains(err.Error(), "circular") {
			BadRequest(c, err.Error())
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, collection)
}

func (h *CollectionHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	var req service.UpdateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	collection, err := h.collectionService.UpdateCollection(uint(id), &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else if strings.Contains(err.Error(), "circular") {
			BadRequest(c, err.Error())
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, collection)
}

func (h *CollectionHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	recursive := c.DefaultQuery("recursive", "false") == "true"

	if err := h.collectionService.DeleteCollection(uint(id), recursive); err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

func (h *CollectionHandler) AddWorks(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	var req service.AddWorksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	resp, err := h.collectionService.AddWorks(uint(id), &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else if strings.Contains(err.Error(), "already in collection") {
			Conflict(c, err.Error())
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, resp)
}

func (h *CollectionHandler) RemoveWorks(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	var req service.RemoveWorksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	resp, err := h.collectionService.RemoveWorks(uint(id), &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, resp)
}

func (h *CollectionHandler) UpdateSortOrder(c *gin.Context) {
	parentIDParam := c.Query("parent_id")
	var parentID *uint
	if parentIDParam != "" {
		id, err := strconv.ParseUint(parentIDParam, 10, 32)
		if err != nil {
			BadRequest(c, "invalid parent collection id")
			return
		}
		pid := uint(id)
		parentID = &pid
	}

	var req service.UpdateSortOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	if err := h.collectionService.UpdateSortOrder(parentID, &req); err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

func (h *CollectionHandler) UpdateWorkSortOrder(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid collection id")
		return
	}

	var req service.UpdateWorkSortOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	if err := h.collectionService.UpdateWorkSortOrder(uint(id), &req); err != nil {
		if strings.Contains(err.Error(), "not found") {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

func parseTagIDs(tagIDsStr string) ([]uint, error) {
	if tagIDsStr == "" {
		return nil, nil
	}
	parts := strings.Split(tagIDsStr, ",")
	var ids []uint
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.ParseUint(part, 10, 32)
		if err != nil {
			return nil, err
		}
		ids = append(ids, uint(id))
	}
	return ids, nil
}
