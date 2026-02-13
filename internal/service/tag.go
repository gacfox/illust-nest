package service

import (
	"errors"
	"illust-nest/internal/model"
	"illust-nest/internal/repository"
)

type TagService struct {
	tagRepo *repository.TagRepository
}

func NewTagService(tagRepo *repository.TagRepository) *TagService {
	return &TagService{tagRepo: tagRepo}
}

func (s *TagService) GetTags(keyword string, includeCount bool) ([]TagInfo, error) {
	tags, err := s.tagRepo.FindAll(keyword, includeCount)
	if err != nil {
		return nil, err
	}

	var tagInfos []TagInfo
	for _, tag := range tags {
		tagInfo := TagInfo{
			ID:        tag.ID,
			Name:      tag.Name,
			IsSystem:  tag.IsSystem,
			WorkCount: tag.WorkCount,
			CreatedAt: tag.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		tagInfos = append(tagInfos, tagInfo)
	}

	return tagInfos, nil
}

func (s *TagService) GetTagByID(id uint) (*model.Tag, error) {
	return s.tagRepo.FindByID(id)
}

func (s *TagService) CreateTag(req *CreateTagRequest) (*model.Tag, error) {
	existing, err := s.tagRepo.FindByName(req.Name)
	if err == nil && existing != nil {
		return nil, &ValidationError{Message: "Tag already exists", Code: 1003}
	}
	if err != nil && !errors.Is(err, repository.ErrTagNotFound) {
		return nil, err
	}

	tag := &model.Tag{
		Name:     req.Name,
		IsSystem: false,
	}

	if err := s.tagRepo.Create(tag); err != nil {
		return nil, err
	}

	return tag, nil
}

func (s *TagService) UpdateTag(id uint, req *UpdateTagRequest) (*model.Tag, error) {
	tag, err := s.tagRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return nil, errors.New("tag not found")
		}
		return nil, err
	}

	if tag.IsSystem {
		return nil, errors.New("cannot update system tag")
	}

	existing, err := s.tagRepo.FindByName(req.Name)
	if err == nil && existing != nil && existing.ID != id {
		return nil, &ValidationError{Message: "Tag name already exists", Code: 1003}
	}
	if err != nil && !errors.Is(err, repository.ErrTagNotFound) {
		return nil, err
	}

	tag.Name = req.Name

	if err := s.tagRepo.Update(tag); err != nil {
		return nil, err
	}

	return tag, nil
}

func (s *TagService) DeleteTag(id uint) error {
	tag, err := s.tagRepo.FindByID(id)
	if err != nil {
		return errors.New("tag not found")
	}

	if tag.IsSystem {
		return errors.New("cannot delete system tag")
	}

	return s.tagRepo.Delete(id)
}

func (s *TagService) BatchCreateTags(req *BatchCreateTagsRequest) (*BatchCreateTagsResponse, error) {
	var createdTags []*model.Tag
	var skipped []string

	for _, name := range req.Names {
		existing, err := s.tagRepo.FindByName(name)
		if err == nil && existing != nil {
			skipped = append(skipped, name)
			continue
		}

		tag, err := s.tagRepo.FirstOrCreate(&model.Tag{Name: name, IsSystem: false})
		if err != nil {
			continue
		}
		createdTags = append(createdTags, tag)
	}

	return &BatchCreateTagsResponse{
		Tags:    createdTags,
		Skipped: skipped,
	}, nil
}

func (s *TagService) ValidateTagIDs(tagIDs []uint) ([]model.Tag, error) {
	if len(tagIDs) == 0 {
		return nil, nil
	}

	return s.tagRepo.FindByIDs(tagIDs)
}

func (s *TagService) GetOrCreateByName(name string) (*model.Tag, error) {
	return s.tagRepo.GetOrCreateByName(name)
}
