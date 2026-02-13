package service

import (
	"errors"
	"illust-nest/internal/model"
	"illust-nest/internal/repository"
)

type CollectionService struct {
	collectionRepo *repository.CollectionRepository
	workRepo       *repository.WorkRepository
}

func NewCollectionService(collectionRepo *repository.CollectionRepository, workRepo *repository.WorkRepository) *CollectionService {
	return &CollectionService{
		collectionRepo: collectionRepo,
		workRepo:       workRepo,
	}
}

func (s *CollectionService) GetTree() ([]*CollectionInfo, error) {
	collections, err := s.collectionRepo.FindTree(nil)
	if err != nil {
		return nil, err
	}

	var result []*CollectionInfo
	for i := range collections {
		result = append(result, s.collectionToInfo(&collections[i]))
	}

	return result, nil
}

func (s *CollectionService) GetCollection(id uint) (*CollectionInfo, error) {
	collection, err := s.collectionRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("collection not found")
	}

	path, err := s.collectionRepo.FindPath(id)
	if err != nil {
		return nil, err
	}

	info := s.collectionToInfo(collection)
	info.Path = make([]*CollectionPath, 0, len(path))
	for _, p := range path {
		info.Path = append(info.Path, &CollectionPath{
			ID:   p.ID,
			Name: p.Name,
		})
	}

	return info, nil
}

func (s *CollectionService) GetCollectionWorks(id uint, params *WorkListParams) (*WorkPagedResult, error) {
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

	works, total, err := s.workRepo.FindByCollectionID(id, repoParams, params.Page, params.PageSize)
	if err != nil {
		return nil, err
	}

	var workInfos []*WorkInfo
	for _, work := range works {
		workInfo := workToInfo(&work, false)
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

func (s *CollectionService) CreateCollection(req *CreateCollectionRequest) (*CollectionInfo, error) {
	if req.ParentID != nil {
		_, err := s.collectionRepo.FindByID(*req.ParentID)
		if err != nil {
			return nil, errors.New("parent collection not found")
		}

		descendants, err := s.collectionRepo.GetDescendants(*req.ParentID)
		if err != nil {
			return nil, err
		}

		for _, desc := range descendants {
			for _, sub := range desc.SubCollections {
				if sub.ParentID != nil && *sub.ParentID == *req.ParentID {
					return nil, errors.New("circular reference: cannot set as descendant")
				}
			}
		}
	}

	collection := &model.Collection{
		Name:        req.Name,
		Description: req.Description,
		ParentID:    req.ParentID,
		SortOrder:   0,
	}

	if err := s.collectionRepo.Create(collection); err != nil {
		return nil, err
	}

	return s.GetCollection(collection.ID)
}

func (s *CollectionService) UpdateCollection(id uint, req *UpdateCollectionRequest) (*CollectionInfo, error) {
	collection, err := s.collectionRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("collection not found")
	}

	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Description != "" {
		collection.Description = req.Description
	}
	if req.ParentID != nil {
		if *req.ParentID == id {
			return nil, errors.New("cannot set self as parent")
		}

		descendants, err := s.collectionRepo.GetDescendants(id)
		if err != nil {
			return nil, err
		}

		for _, desc := range descendants {
			if desc.ID == *req.ParentID {
				return nil, errors.New("circular reference: cannot set as descendant")
			}
		}

		collection.ParentID = req.ParentID
	}

	if err := s.collectionRepo.Update(collection); err != nil {
		return nil, err
	}

	return s.GetCollection(id)
}

func (s *CollectionService) DeleteCollection(id uint, recursive bool) error {
	if !recursive {
		_, err := s.collectionRepo.FindByID(id)
		if err != nil {
			return errors.New("collection not found")
		}
	}

	return s.collectionRepo.Delete(id, recursive)
}

func (s *CollectionService) AddWorks(id uint, req *AddWorksRequest) (*WorksResult, error) {
	_, err := s.collectionRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("collection not found")
	}

	addedCount, skippedCount, err := s.collectionRepo.AddWorks(id, req.WorkIDs)
	if err != nil {
		return nil, err
	}

	if addedCount == 0 && skippedCount > 0 {
		return nil, errors.New("all works already in collection")
	}

	works, _, err := s.workRepo.FindByCollectionID(id, map[string]interface{}{}, 1, 1000)
	if err != nil {
		return nil, err
	}

	var workInfos []*WorkInfo
	for _, work := range works {
		workInfo := workToInfo(&work, false)
		workInfos = append(workInfos, workInfo)
	}

	return &WorksResult{Works: workInfos}, nil
}

func (s *CollectionService) RemoveWorks(id uint, req *RemoveWorksRequest) (*WorksResult, error) {
	_, err := s.collectionRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("collection not found")
	}

	removedCount, err := s.collectionRepo.RemoveWorks(id, req.WorkIDs)
	if err != nil {
		return nil, err
	}

	if removedCount == 0 {
		return nil, errors.New("no works removed")
	}

	works, _, err := s.workRepo.FindByCollectionID(id, map[string]interface{}{}, 1, 1000)
	if err != nil {
		return nil, err
	}

	var workInfos []*WorkInfo
	for _, work := range works {
		workInfo := workToInfo(&work, false)
		workInfos = append(workInfos, workInfo)
	}

	return &WorksResult{Works: workInfos}, nil
}

func (s *CollectionService) UpdateSortOrder(parentID *uint, req *UpdateSortOrderRequest) error {
	if parentID != nil {
		_, err := s.collectionRepo.FindByID(*parentID)
		if err != nil {
			return errors.New("parent collection not found")
		}
	}

	return s.collectionRepo.UpdateSortOrder(parentID, req.CollectionIDs)
}

func (s *CollectionService) UpdateWorkSortOrder(id uint, req *UpdateWorkSortOrderRequest) error {
	_, err := s.collectionRepo.FindByID(id)
	if err != nil {
		return errors.New("collection not found")
	}

	return s.collectionRepo.UpdateWorkSortOrder(id, req.WorkIDs)
}

func (s *CollectionService) collectionToInfo(collection *model.Collection) *CollectionInfo {
	info := &CollectionInfo{
		ID:          collection.ID,
		Name:        collection.Name,
		Description: collection.Description,
		ParentID:    collection.ParentID,
		SortOrder:   collection.SortOrder,
		CreatedAt:   collection.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   collection.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		WorkCount:   collection.WorkCount,
	}

	if len(collection.SubCollections) > 0 {
		info.SubCollections = make([]*CollectionInfo, 0, len(collection.SubCollections))
		for i := range collection.SubCollections {
			info.SubCollections = append(info.SubCollections, s.collectionToInfo(&collection.SubCollections[i]))
		}
	}

	return info
}

func workToInfo(work *model.Work, fullDetails bool) *WorkInfo {
	info := &WorkInfo{
		ID:          work.ID,
		Title:       work.Title,
		Description: work.Description,
		Rating:      work.Rating,
		IsPublic:    work.IsPublic,
		CreatedAt:   work.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   work.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if fullDetails && len(work.Images) > 0 {
		info.CoverImage = &ImageInfo{
			ID:            work.Images[0].ID,
			ThumbnailPath: work.Images[0].ThumbnailPath,
			OriginalPath:  work.Images[0].StoragePath,
			FileSize:      work.Images[0].FileSize,
			Width:         work.Images[0].Width,
			Height:        work.Images[0].Height,
			SortOrder:     work.Images[0].SortOrder,
		}

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
	}

	if len(work.Images) > 0 {
		info.ImageCount = len(work.Images)
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
