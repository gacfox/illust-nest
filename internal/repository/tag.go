package repository

import (
	"errors"
	"illust-nest/internal/model"

	"gorm.io/gorm"
)

var ErrTagNotFound = errors.New("tag not found")

type TagRepository struct {
	DB *gorm.DB
}

func NewTagRepository(db *gorm.DB) *TagRepository {
	return &TagRepository{DB: db}
}

func (r *TagRepository) Create(tag *model.Tag) error {
	return r.DB.Create(tag).Error
}

func (r *TagRepository) FindByID(id uint) (*model.Tag, error) {
	var tag model.Tag
	err := r.DB.First(&tag, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTagNotFound
		}
		return nil, err
	}
	return &tag, nil
}

func (r *TagRepository) FindByName(name string) (*model.Tag, error) {
	var tag model.Tag
	err := r.DB.Where("name = ?", name).First(&tag).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTagNotFound
		}
		return nil, err
	}
	return &tag, nil
}

func (r *TagRepository) FindAll(keyword string, includeCount bool) ([]model.Tag, error) {
	var tags []model.Tag
	query := r.DB.Model(&model.Tag{})

	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	err := query.Order("is_system DESC, id ASC").Find(&tags).Error
	if err != nil {
		return nil, err
	}

	if includeCount {
		for i := range tags {
			var count int64
			r.DB.Model(&model.WorkTag{}).Where("tag_id = ?", tags[i].ID).Count(&count)
			tags[i].WorkCount = int(count)
		}
	}

	return tags, nil
}

func (r *TagRepository) Update(tag *model.Tag) error {
	return r.DB.Save(tag).Error
}

func (r *TagRepository) Delete(id uint) error {
	return r.DB.Delete(&model.Tag{}, id).Error
}

func (r *TagRepository) FirstOrCreate(tag *model.Tag) (*model.Tag, error) {
	err := r.DB.Where("name = ?", tag.Name).FirstOrCreate(tag).Error
	if err != nil {
		return nil, err
	}
	return tag, nil
}

func (r *TagRepository) GetOrCreateByName(name string) (*model.Tag, error) {
	var tag model.Tag
	err := r.DB.Where("name = ?", name).FirstOrCreate(&tag, model.Tag{Name: name}).Error
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

func (r *TagRepository) FindByIDs(ids []uint) ([]model.Tag, error) {
	var tags []model.Tag
	err := r.DB.Where("id IN ?", ids).Find(&tags).Error
	return tags, err
}
