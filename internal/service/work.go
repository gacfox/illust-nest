package service

import (
	"errors"
	"illust-nest/internal/model"
	"illust-nest/internal/repository"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/tiff"
)

type WorkService struct {
	workRepo     *repository.WorkRepository
	tagRepo      *repository.TagRepository
	imageService *ImageService
}

func NewWorkService(workRepo *repository.WorkRepository, tagRepo *repository.TagRepository, imageService *ImageService) *WorkService {
	return &WorkService{
		workRepo:     workRepo,
		tagRepo:      tagRepo,
		imageService: imageService,
	}
}

func (s *WorkService) GetWorks(params *WorkListParams) (*WorkPagedResult, error) {
	repoParams := make(map[string]interface{})
	if params.Keyword != "" {
		repoParams["keyword"] = params.Keyword
	}
	if len(params.TagIDs) > 0 {
		repoParams["tag_ids"] = params.TagIDs
	}
	if params.RatingMin >= 0 {
		repoParams["rating_min"] = params.RatingMin
	}
	if params.RatingMax >= 0 {
		repoParams["rating_max"] = params.RatingMax
	}
	if params.IsPublic != nil {
		repoParams["is_public"] = *params.IsPublic
	}
	if params.SortBy != "" {
		repoParams["sort_by"] = params.SortBy
	}
	if params.SortOrder != "" {
		repoParams["sort_order"] = params.SortOrder
	}

	works, total, err := s.workRepo.FindAll(repoParams, params.Page, params.PageSize)
	if err != nil {
		return nil, err
	}

	var workInfos []*WorkInfo
	for _, work := range works {
		workInfo := s.workToInfo(&work, false)
		workInfos = append(workInfos, workInfo)
	}

	totalPages := int(total) / params.PageSize
	if int(total)%params.PageSize > 0 {
		totalPages++
	}

	return &WorkPagedResult{
		Items:      workInfos,
		Total:      total,
		Page:       params.Page,
		PageSize:   params.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *WorkService) GetWorkByID(id uint) (*WorkInfo, error) {
	work, err := s.workRepo.FindByID(id, true)
	if err != nil {
		return nil, errors.New("work not found")
	}
	return s.workToInfo(work, true), nil
}

func (s *WorkService) GetPublicWorks(params *WorkListParams) (*WorkPagedResult, error) {
	public := true
	params.IsPublic = &public
	return s.GetWorks(params)
}

func (s *WorkService) GetPublicWorkByID(id uint) (*WorkInfo, error) {
	work, err := s.workRepo.FindByID(id, true)
	if err != nil || !work.IsPublic {
		return nil, errors.New("work not found")
	}
	return s.workToInfo(work, true), nil
}

func (s *WorkService) IsPublicImagePath(path string, isThumbnail bool) (bool, error) {
	return s.workRepo.IsPublicImagePath(path, isThumbnail)
}

func (s *WorkService) CreateWork(req *CreateWorkRequest, uploadedImages []*UploadedImage) (*WorkInfo, error) {
	if len(uploadedImages) == 0 {
		return nil, errors.New("at least one image is required")
	}

	work := &model.Work{
		Title:       req.Title,
		Description: req.Description,
		Rating:      req.Rating,
		IsPublic:    req.IsPublic,
	}

	if req.TagIDs != nil {
		tags, err := s.tagRepo.FindByIDs(req.TagIDs)
		if err != nil {
			return nil, err
		}
		work.Tags = tags
	}

	var images []model.WorkImage
	for _, uploaded := range uploadedImages {
		images = append(images, model.WorkImage{
			StoragePath:    uploaded.StoragePath,
			TranscodedPath: uploaded.TranscodedPath,
			ThumbnailPath:  uploaded.ThumbnailPath,
			ImageHash:      normalizeImageHash(uploaded.ImageHash),
			FileSize:       uploaded.FileSize,
			Width:          uploaded.Width,
			Height:         uploaded.Height,
		})
	}
	work.Images = images

	if err := s.workRepo.Create(work); err != nil {
		return nil, err
	}

	return s.workToInfo(work, true), nil
}

func (s *WorkService) UpdateWork(id uint, req *UpdateWorkRequest) (*WorkInfo, error) {
	work, err := s.workRepo.FindByID(id, false)
	if err != nil {
		return nil, errors.New("work not found")
	}

	if req.Title != "" {
		work.Title = req.Title
	}
	if req.Description != "" {
		work.Description = req.Description
	}
	if req.Rating >= 0 {
		work.Rating = req.Rating
	}
	if req.IsPublic != nil {
		work.IsPublic = *req.IsPublic
	}

	tagIDs := req.TagIDs
	if tagIDs == nil {
		tagIDs = []uint{}
	}

	if err := s.workRepo.Update(work, tagIDs); err != nil {
		return nil, err
	}

	updatedWork, err := s.workRepo.FindByID(id, true)
	if err != nil {
		return nil, err
	}

	return s.workToInfo(updatedWork, true), nil
}

func (s *WorkService) DeleteWork(id uint) error {
	work, err := s.workRepo.FindByID(id, true)
	if err != nil {
		return errors.New("work not found")
	}

	for _, img := range work.Images {
		if err := s.imageService.DeleteImage(img.StoragePath, img.ThumbnailPath, img.TranscodedPath); err != nil {
			return err
		}
	}

	return s.workRepo.Delete(id)
}

func (s *WorkService) BatchDeleteWorks(ids []uint) (int64, error) {
	for _, id := range ids {
		work, err := s.workRepo.FindByID(id, true)
		if err != nil {
			continue
		}
		for _, img := range work.Images {
			s.imageService.DeleteImage(img.StoragePath, img.ThumbnailPath, img.TranscodedPath)
		}
	}
	return s.workRepo.BatchDelete(ids)
}

func (s *WorkService) BatchUpdatePublicStatus(ids []uint, isPublic bool) (int64, error) {
	return s.workRepo.BatchUpdatePublicStatus(ids, isPublic)
}

func (s *WorkService) AddImages(workID uint, uploadedImages []*UploadedImage) ([]*ImageInfo, error) {
	existingCount, err := s.workRepo.FindImageCount(workID)
	if err != nil {
		return nil, err
	}

	if existingCount+int64(len(uploadedImages)) == 0 {
		return nil, errors.New("work must have at least one image")
	}

	var images []model.WorkImage
	for _, uploaded := range uploadedImages {
		images = append(images, model.WorkImage{
			StoragePath:    uploaded.StoragePath,
			TranscodedPath: uploaded.TranscodedPath,
			ThumbnailPath:  uploaded.ThumbnailPath,
			ImageHash:      normalizeImageHash(uploaded.ImageHash),
			FileSize:       uploaded.FileSize,
			Width:          uploaded.Width,
			Height:         uploaded.Height,
		})
	}

	if err := s.workRepo.AddImages(workID, images); err != nil {
		return nil, err
	}

	var imageInfos []*ImageInfo
	for i := range images {
		imageInfos = append(imageInfos, &ImageInfo{
			ID:             images[i].ID,
			ThumbnailPath:  images[i].ThumbnailPath,
			OriginalPath:   images[i].StoragePath,
			TranscodedPath: images[i].TranscodedPath,
			ImageHash:      images[i].ImageHash,
			FileSize:       images[i].FileSize,
			Width:          images[i].Width,
			Height:         images[i].Height,
			SortOrder:      images[i].SortOrder,
		})
	}

	return imageInfos, nil
}

func (s *WorkService) DeleteImage(workID, imageID uint) error {
	imageCount, err := s.workRepo.FindImageCount(workID)
	if err != nil {
		return err
	}

	if imageCount <= 1 {
		return errors.New("cannot delete the last image")
	}

	image, err := s.workRepo.FindFirstOrDefaultImage(workID)
	if err != nil {
		return err
	}

	if err := s.imageService.DeleteImage(image.StoragePath, image.ThumbnailPath, image.TranscodedPath); err != nil {
		return err
	}

	return s.workRepo.DeleteImage(imageID)
}

func (s *WorkService) UpdateImageOrder(workID uint, imageIDs []uint) error {
	return s.workRepo.UpdateImageOrder(workID, imageIDs)
}

func (s *WorkService) workToInfo(work *model.Work, fullDetails bool) *WorkInfo {
	info := &WorkInfo{
		ID:          work.ID,
		Title:       work.Title,
		Description: work.Description,
		Rating:      work.Rating,
		IsPublic:    work.IsPublic,
		CreatedAt:   work.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   work.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if len(work.Images) > 0 {
		info.CoverImage = &ImageInfo{
			ID:             work.Images[0].ID,
			ThumbnailPath:  work.Images[0].ThumbnailPath,
			OriginalPath:   work.Images[0].StoragePath,
			TranscodedPath: work.Images[0].TranscodedPath,
			ImageHash:      work.Images[0].ImageHash,
			FileSize:       work.Images[0].FileSize,
			Width:          work.Images[0].Width,
			Height:         work.Images[0].Height,
			SortOrder:      work.Images[0].SortOrder,
		}
		info.ImageCount = len(work.Images)
	}

	if fullDetails {
		var images []ImageInfo
		for _, img := range work.Images {
			images = append(images, ImageInfo{
				ID:             img.ID,
				ThumbnailPath:  img.ThumbnailPath,
				OriginalPath:   img.StoragePath,
				TranscodedPath: img.TranscodedPath,
				ImageHash:      img.ImageHash,
				FileSize:       img.FileSize,
				Width:          img.Width,
				Height:         img.Height,
				SortOrder:      img.SortOrder,
			})
		}
		info.Images = images
	}

	if len(work.Tags) > 0 {
		var tags []*model.Tag
		for _, tag := range work.Tags {
			tags = append(tags, &tag)
		}
		info.Tags = tags
	}

	return info
}

func (s *WorkService) ParseTagIDs(tagIDsStr string) ([]uint, error) {
	if tagIDsStr == "" {
		return nil, nil
	}

	var tagIDs []uint
	parts := splitString(tagIDsStr, ",")
	for _, part := range parts {
		id, err := strconv.Atoi(part)
		if err != nil {
			return nil, err
		}
		tagIDs = append(tagIDs, uint(id))
	}

	return tagIDs, nil
}

func (s *WorkService) ListExportImages() ([]ExportImageRecord, error) {
	works, err := s.workRepo.FindAllForExport()
	if err != nil {
		return nil, err
	}

	records := make([]ExportImageRecord, 0)
	for _, work := range works {
		tagNames := make([]string, 0, len(work.Tags))
		for _, tag := range work.Tags {
			if tag.Name == "" {
				continue
			}
			tagNames = append(tagNames, tag.Name)
		}
		tags := strings.Join(tagNames, ", ")
		createdAt := work.CreatedAt.Format("2006-01-02 15:04:05")
		for _, image := range work.Images {
			if image.StoragePath == "" {
				continue
			}
			records = append(records, ExportImageRecord{
				Path:        image.StoragePath,
				Title:       work.Title,
				Description: work.Description,
				Tags:        tags,
				Rating:      work.Rating,
				CreatedAt:   createdAt,
			})
		}
	}

	return records, nil
}

func splitString(s, sep string) []string {
	if s == "" {
		return []string{}
	}
	parts := []string{}
	start := 0
	for i := 0; i < len(s); i++ {
		if string(s[i]) == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

func normalizeImageHash(hash string) string {
	return strings.ToLower(strings.TrimSpace(hash))
}

func normalizeImageHashes(hashes []string) []string {
	normalized := make([]string, 0, len(hashes))
	seen := make(map[string]struct{})
	for _, hash := range hashes {
		cleaned := normalizeImageHash(hash)
		if cleaned == "" {
			continue
		}
		if _, exists := seen[cleaned]; exists {
			continue
		}
		seen[cleaned] = struct{}{}
		normalized = append(normalized, cleaned)
	}
	return normalized
}

func (s *WorkService) CheckDuplicateImages(hashes []string, excludeWorkID *uint) ([]DuplicateImageInfo, error) {
	normalized := normalizeImageHashes(hashes)
	if len(normalized) == 0 {
		return []DuplicateImageInfo{}, nil
	}

	images, err := s.workRepo.FindDuplicateImagesByHashes(normalized, excludeWorkID)
	if err != nil {
		return nil, err
	}

	byHash := make(map[string]DuplicateImageInfo)
	for _, img := range images {
		cleaned := normalizeImageHash(img.ImageHash)
		if cleaned == "" {
			continue
		}
		if _, exists := byHash[cleaned]; exists {
			continue
		}
		byHash[cleaned] = DuplicateImageInfo{
			ImageHash: cleaned,
			WorkID:    img.WorkID,
			ImageID:   img.ID,
		}
	}

	duplicates := make([]DuplicateImageInfo, 0)
	for _, hash := range normalized {
		if item, ok := byHash[hash]; ok {
			duplicates = append(duplicates, item)
		}
	}
	return duplicates, nil
}

func (s *WorkService) GetImageEXIF(workID, imageID uint) (*ImageEXIFInfo, error) {
	image, err := s.workRepo.FindImageByID(workID, imageID)
	if err != nil {
		return nil, errors.New("image not found")
	}

	ext := strings.ToLower(filepath.Ext(image.StoragePath))
	if !isEXIFSupportedSourceExt(ext) {
		return nil, errors.New("EXIF only supports JPG/TIFF source images")
	}

	fullPath, err := ResolveUploadPath(image.StoragePath)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(fullPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	info := &ImageEXIFInfo{
		WorkID:   workID,
		ImageID:  imageID,
		HasEXIF:  false,
		Fields:   []ImageEXIFField{},
		Format:   strings.TrimPrefix(ext, "."),
		Filename: filepath.Base(image.StoragePath),
	}

	meta, err := exif.Decode(file)
	if err != nil {
		if isNoEXIFDecodeError(err) {
			return info, nil
		}
		return nil, err
	}

	walker := &imageEXIFWalker{
		fields: make([]ImageEXIFField, 0),
	}
	if err := meta.Walk(walker); err != nil {
		return nil, err
	}

	sort.Slice(walker.fields, func(i, j int) bool {
		return walker.fields[i].Key < walker.fields[j].Key
	})
	info.Fields = walker.fields
	info.HasEXIF = len(walker.fields) > 0
	return info, nil
}

func isEXIFSupportedSourceExt(ext string) bool {
	switch strings.ToLower(strings.TrimSpace(ext)) {
	case ".jpg", ".jpeg", ".tif", ".tiff":
		return true
	default:
		return false
	}
}

func isNoEXIFDecodeError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(strings.TrimSpace(err.Error()))
	noExifMarkers := []string{
		"no exif data",
		"failed to find exif intro marker",
		"failed to find beginning of tiff header",
		"failed to read tiff",
	}
	for _, marker := range noExifMarkers {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}

type imageEXIFWalker struct {
	fields []ImageEXIFField
}

func (w *imageEXIFWalker) Walk(name exif.FieldName, tag *tiff.Tag) error {
	if tag == nil {
		return nil
	}
	w.fields = append(w.fields, ImageEXIFField{
		Key:   string(name),
		Value: strings.TrimSpace(tag.String()),
	})
	return nil
}
