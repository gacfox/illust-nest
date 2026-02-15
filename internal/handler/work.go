package handler

import (
	"archive/zip"
	"illust-nest/internal/service"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type WorkHandler struct {
	workService  *service.WorkService
	imageService *service.ImageService
}

func NewWorkHandler(workService *service.WorkService, imageService *service.ImageService) *WorkHandler {
	return &WorkHandler{
		workService:  workService,
		imageService: imageService,
	}
}

func (h *WorkHandler) List(c *gin.Context) {
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
		IsPublic:  isPublic,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}

	result, err := h.workService.GetWorks(params)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, result)
}

func (h *WorkHandler) Get(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	work, err := h.workService.GetWorkByID(uint(id))
	if err != nil {
		NotFound(c)
		return
	}

	Success(c, work)
}

func (h *WorkHandler) Create(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		BadRequest(c, err.Error())
		return
	}

	title := form.Value["title"][0]
	description := ""
	if len(form.Value["description"]) > 0 {
		description = form.Value["description"][0]
	}

	rating := 0
	if len(form.Value["rating"]) > 0 {
		if val, err := strconv.Atoi(form.Value["rating"][0]); err == nil && val >= 0 && val <= 5 {
			rating = val
		}
	}

	isPublic := false
	if len(form.Value["is_public"]) > 0 {
		if val, err := strconv.ParseBool(form.Value["is_public"][0]); err == nil {
			isPublic = val
		}
	}

	var tagIDs []uint
	if len(form.Value["tag_ids"]) > 0 {
		ids, err := h.workService.ParseTagIDs(form.Value["tag_ids"][0])
		if err == nil {
			tagIDs = ids
		}
	}

	req := &service.CreateWorkRequest{
		Title:       title,
		Description: description,
		Rating:      rating,
		IsPublic:    isPublic,
		TagIDs:      tagIDs,
	}

	files := form.File["images"]
	if len(files) == 0 {
		BadRequest(c, "at least one image is required")
		return
	}

	for _, file := range files {
		if file.Size > service.MaxUploadFileSizeBytes {
			BadRequest(c, "file size exceeds 20MB")
			return
		}
	}

	uploadedImages, err := h.imageService.UploadImages(files)
	if err != nil {
		InternalErrorWithMessage(c, err.Error())
		return
	}

	imageHashes := parseImageHashes(form.Value["image_hashes"])
	for i := range uploadedImages {
		if i < len(imageHashes) {
			uploadedImages[i].ImageHash = imageHashes[i]
		}
	}

	work, err := h.workService.CreateWork(req, uploadedImages)
	if err != nil {
		InternalErrorWithMessage(c, err.Error())
		return
	}

	Success(c, work)
}

func (h *WorkHandler) Update(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	var req service.UpdateWorkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	work, err := h.workService.UpdateWork(uint(id), &req)
	if err != nil {
		if err.Error() == "work not found" {
			NotFound(c)
		} else {
			InternalErrorWithMessage(c, err.Error())
		}
		return
	}

	Success(c, work)
}

func (h *WorkHandler) Delete(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	if err := h.workService.DeleteWork(uint(id)); err != nil {
		if err.Error() == "work not found" {
			NotFound(c)
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

type BatchDeleteRequest struct {
	IDs []uint `json:"ids" binding:"required,min=1"`
}

type BatchDeleteResponse struct {
	DeletedCount int64 `json:"deleted_count"`
}

func (h *WorkHandler) BatchDelete(c *gin.Context) {
	var req BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	count, err := h.workService.BatchDeleteWorks(req.IDs)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, &BatchDeleteResponse{DeletedCount: count})
}

func (h *WorkHandler) AddImages(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		BadRequest(c, err.Error())
		return
	}

	files := form.File["images"]
	if len(files) == 0 {
		BadRequest(c, "at least one image is required")
		return
	}

	uploadedImages, err := h.imageService.UploadImages(files)
	if err != nil {
		InternalErrorWithMessage(c, err.Error())
		return
	}

	imageHashes := parseImageHashes(form.Value["image_hashes"])
	for i := range uploadedImages {
		if i < len(imageHashes) {
			uploadedImages[i].ImageHash = imageHashes[i]
		}
	}

	images, err := h.workService.AddImages(uint(id), uploadedImages)
	if err != nil {
		InternalErrorWithMessage(c, err.Error())
		return
	}

	Success(c, gin.H{"images": images})
}

func (h *WorkHandler) DeleteImage(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	imageIDParam := c.Param("imageId")
	imageID, err := strconv.ParseUint(imageIDParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid image id")
		return
	}

	if err := h.workService.DeleteImage(uint(id), uint(imageID)); err != nil {
		if err.Error() == "work not found" || err.Error() == "cannot delete the last image" {
			BadRequest(c, err.Error())
		} else {
			InternalError(c)
		}
		return
	}

	Success(c, nil)
}

type UpdateImageOrderRequest struct {
	ImageIDs []uint `json:"image_ids" binding:"required,min=1"`
}

func (h *WorkHandler) UpdateImageOrder(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		BadRequest(c, "invalid work id")
		return
	}

	var req UpdateImageOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	if err := h.workService.UpdateImageOrder(uint(id), req.ImageIDs); err != nil {
		InternalError(c)
		return
	}

	Success(c, nil)
}

func (h *WorkHandler) CheckDuplicateImages(c *gin.Context) {
	var req service.DuplicateImageCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	duplicates, err := h.workService.CheckDuplicateImages(req.ImageHashes, req.ExcludeWorkID)
	if err != nil {
		InternalErrorWithMessage(c, err.Error())
		return
	}

	Success(c, service.DuplicateImageCheckResponse{
		Duplicates: duplicates,
	})
}

type BatchUpdatePublicRequest struct {
	IDs      []uint `json:"ids" binding:"required,min=1"`
	IsPublic *bool  `json:"is_public" binding:"required"`
}

type BatchUpdatePublicResponse struct {
	UpdatedCount int64 `json:"updated_count"`
}

func (h *WorkHandler) BatchUpdatePublic(c *gin.Context) {
	var req BatchUpdatePublicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}
	if req.IsPublic == nil {
		BadRequest(c, "is_public is required")
		return
	}

	count, err := h.workService.BatchUpdatePublicStatus(req.IDs, *req.IsPublic)
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, &BatchUpdatePublicResponse{UpdatedCount: count})
}

func (h *WorkHandler) ExportImages(c *gin.Context) {
	records, err := h.workService.ListExportImages()
	if err != nil {
		InternalError(c)
		return
	}

	filename := "illust-nest-images-" + time.Now().Format("20060102-150405") + ".zip"
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Status(200)

	zipWriter := zip.NewWriter(c.Writer)
	defer zipWriter.Close()

	added := make(map[string]struct{}, len(records))
	for _, record := range records {
		cleanPath := filepath.ToSlash(filepath.Clean(record.Path))
		if cleanPath == "." || cleanPath == "" || strings.HasPrefix(cleanPath, "..") || strings.Contains(cleanPath, "/../") {
			continue
		}
		fullPathAbs, err := service.ResolveUploadPath(cleanPath)
		if err != nil {
			continue
		}
		if _, exists := added[fullPathAbs]; exists {
			continue
		}

		file, err := os.Open(fullPathAbs)
		if err != nil {
			continue
		}

		entryName := filepath.ToSlash(cleanPath)
		entryWriter, err := zipWriter.Create(entryName)
		if err != nil {
			file.Close()
			continue
		}

		_, _ = io.Copy(entryWriter, file)
		file.Close()
		added[fullPathAbs] = struct{}{}
	}

	indexFile := excelize.NewFile()
	defer indexFile.Close()

	sheetName := "索引"
	defaultSheet := indexFile.GetSheetName(indexFile.GetActiveSheetIndex())
	if defaultSheet != sheetName {
		indexFile.SetSheetName(defaultSheet, sheetName)
	}

	headers := []string{"路径", "标题", "描述", "标签", "评分", "创建时间"}
	for idx, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
		_ = indexFile.SetCellValue(sheetName, cell, header)
	}

	for rowIndex, record := range records {
		row := rowIndex + 2
		pathCell, _ := excelize.CoordinatesToCellName(1, row)
		titleCell, _ := excelize.CoordinatesToCellName(2, row)
		descCell, _ := excelize.CoordinatesToCellName(3, row)
		tagsCell, _ := excelize.CoordinatesToCellName(4, row)
		ratingCell, _ := excelize.CoordinatesToCellName(5, row)
		createdAtCell, _ := excelize.CoordinatesToCellName(6, row)

		_ = indexFile.SetCellValue(sheetName, pathCell, filepath.ToSlash(filepath.Clean(record.Path)))
		_ = indexFile.SetCellValue(sheetName, titleCell, record.Title)
		_ = indexFile.SetCellValue(sheetName, descCell, record.Description)
		_ = indexFile.SetCellValue(sheetName, tagsCell, record.Tags)
		_ = indexFile.SetCellValue(sheetName, ratingCell, record.Rating)
		_ = indexFile.SetCellValue(sheetName, createdAtCell, record.CreatedAt)
	}

	_ = indexFile.SetColWidth(sheetName, "A", "A", 52)
	_ = indexFile.SetColWidth(sheetName, "B", "B", 24)
	_ = indexFile.SetColWidth(sheetName, "C", "C", 36)
	_ = indexFile.SetColWidth(sheetName, "D", "D", 24)
	_ = indexFile.SetColWidth(sheetName, "E", "E", 10)
	_ = indexFile.SetColWidth(sheetName, "F", "F", 22)

	indexBuffer, err := indexFile.WriteToBuffer()
	if err != nil {
		return
	}
	indexEntry, err := zipWriter.Create("index.xlsx")
	if err != nil {
		return
	}
	_, _ = indexEntry.Write(indexBuffer.Bytes())
}

func parseImageHashes(values []string) []string {
	hashes := make([]string, 0, len(values))
	for _, raw := range values {
		for _, part := range strings.Split(raw, ",") {
			hash := strings.TrimSpace(part)
			if hash == "" {
				continue
			}
			hashes = append(hashes, hash)
		}
	}
	return hashes
}
