package service

import (
	"errors"
	"illust-nest/internal/model"
	"illust-nest/internal/repository"
	"strconv"
	"strings"
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
			StoragePath:   uploaded.StoragePath,
			ThumbnailPath: uploaded.ThumbnailPath,
			FileSize:      uploaded.FileSize,
			Width:         uploaded.Width,
			Height:        uploaded.Height,
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
		if err := s.imageService.DeleteImage(img.StoragePath, img.ThumbnailPath); err != nil {
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
			s.imageService.DeleteImage(img.StoragePath, img.ThumbnailPath)
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
			StoragePath:   uploaded.StoragePath,
			ThumbnailPath: uploaded.ThumbnailPath,
			FileSize:      uploaded.FileSize,
			Width:         uploaded.Width,
			Height:        uploaded.Height,
		})
	}

	if err := s.workRepo.AddImages(workID, images); err != nil {
		return nil, err
	}

	var imageInfos []*ImageInfo
	for i := range images {
		imageInfos = append(imageInfos, &ImageInfo{
			ID:            images[i].ID,
			ThumbnailPath: images[i].ThumbnailPath,
			OriginalPath:  images[i].StoragePath,
			FileSize:      images[i].FileSize,
			Width:         images[i].Width,
			Height:        images[i].Height,
			SortOrder:     images[i].SortOrder,
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

	if err := s.imageService.DeleteImage(image.StoragePath, image.ThumbnailPath); err != nil {
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
			ID:            work.Images[0].ID,
			ThumbnailPath: work.Images[0].ThumbnailPath,
			OriginalPath:  work.Images[0].StoragePath,
			FileSize:      work.Images[0].FileSize,
			Width:         work.Images[0].Width,
			Height:        work.Images[0].Height,
			SortOrder:     work.Images[0].SortOrder,
		}
		info.ImageCount = len(work.Images)
	}

	if fullDetails {
		var images []ImageInfo
		for _, img := range work.Images {
			images = append(images, ImageInfo{
				ID:            img.ID,
				ThumbnailPath: img.ThumbnailPath,
				OriginalPath:  img.StoragePath,
				FileSize:      img.FileSize,
				Width:         img.Width,
				Height:        img.Height,
				SortOrder:     img.SortOrder,
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
