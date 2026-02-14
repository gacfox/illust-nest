package repository

import (
	"illust-nest/internal/model"

	"gorm.io/gorm"
)

type WorkRepository struct {
	DB *gorm.DB
}

func NewWorkRepository(db *gorm.DB) *WorkRepository {
	return &WorkRepository{DB: db}
}

func (r *WorkRepository) Create(work *model.Work) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Images", "Tags").Create(work).Error; err != nil {
			return err
		}
		for i := range work.Images {
			work.Images[i].WorkID = work.ID
			work.Images[i].SortOrder = i
		}
		if len(work.Images) > 0 {
			if err := tx.Create(&work.Images).Error; err != nil {
				return err
			}
		}
		if len(work.Tags) > 0 {
			var tagIds []uint
			for _, tag := range work.Tags {
				tagIds = append(tagIds, tag.ID)
			}
			for _, tagID := range tagIds {
				if err := tx.Create(&model.WorkTag{WorkID: work.ID, TagID: tagID}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (r *WorkRepository) FindByID(id uint, fullDetails bool) (*model.Work, error) {
	var work model.Work
	query := r.DB

	if fullDetails {
		query = query.Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).Preload("Tags")
	}

	err := query.First(&work, id).Error
	if err != nil {
		return nil, err
	}

	return &work, nil
}

func (r *WorkRepository) FindAll(params map[string]interface{}, page, pageSize int) ([]model.Work, int64, error) {
	var works []model.Work
	var total int64

	query := r.DB.Model(&model.Work{}).
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Tags")

	if keyword, ok := params["keyword"].(string); ok && keyword != "" {
		query = query.Where("title LIKE ? OR description LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if tagIDs, ok := params["tag_ids"].([]uint); ok && len(tagIDs) > 0 {
		query = query.Joins("JOIN work_tags ON work_tags.work_id = works.id").
			Where("work_tags.tag_id IN ?", tagIDs).
			Group("works.id")
	}

	if ratingMin, ok := params["rating_min"].(int); ok {
		query = query.Where("rating >= ?", ratingMin)
	}

	if ratingMax, ok := params["rating_max"].(int); ok {
		query = query.Where("rating <= ?", ratingMax)
	}

	if isPublic, ok := params["is_public"].(bool); ok {
		query = query.Where("is_public = ?", isPublic)
	}

	sortBy := "created_at"
	if s, ok := params["sort_by"].(string); ok && s != "" {
		sortBy = s
	}
	sortOrder := "desc"
	if s, ok := params["sort_order"].(string); ok && s != "" {
		sortOrder = s
	}
	query = query.Order(sortBy + " " + sortOrder)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&works).Error; err != nil {
		return nil, 0, err
	}

	return works, total, nil
}

func (r *WorkRepository) Update(work *model.Work, tagIDs []uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(work).Updates(map[string]interface{}{
			"title":       work.Title,
			"description": work.Description,
			"rating":      work.Rating,
			"is_public":   work.IsPublic,
		}).Error; err != nil {
			return err
		}

		if err := tx.Where("work_id = ?", work.ID).Delete(&model.WorkTag{}).Error; err != nil {
			return err
		}

		for _, tagID := range tagIDs {
			if err := tx.Create(&model.WorkTag{WorkID: work.ID, TagID: tagID}).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *WorkRepository) Delete(id uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("work_id = ?", id).Delete(&model.WorkTag{}).Error; err != nil {
			return err
		}
		if err := tx.Where("work_id = ?", id).Delete(&model.CollectionWork{}).Error; err != nil {
			return err
		}
		if err := tx.Where("work_id = ?", id).Delete(&model.WorkImage{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Work{}, id).Error
	})
}

func (r *WorkRepository) BatchDelete(ids []uint) (int64, error) {
	var deletedCount int64
	err := r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("work_id IN ?", ids).Delete(&model.WorkTag{}).Error; err != nil {
			return err
		}
		if err := tx.Where("work_id IN ?", ids).Delete(&model.CollectionWork{}).Error; err != nil {
			return err
		}
		if err := tx.Where("work_id IN ?", ids).Delete(&model.WorkImage{}).Error; err != nil {
			return err
		}
		result := tx.Where("id IN ?", ids).Delete(&model.Work{})
		deletedCount = result.RowsAffected
		return result.Error
	})
	return deletedCount, err
}

func (r *WorkRepository) BatchUpdatePublicStatus(ids []uint, isPublic bool) (int64, error) {
	result := r.DB.Model(&model.Work{}).Where("id IN ?", ids).Update("is_public", isPublic)
	return result.RowsAffected, result.Error
}

func (r *WorkRepository) AddImages(workID uint, images []model.WorkImage) error {
	for i := range images {
		images[i].WorkID = workID
		images[i].SortOrder = i
	}
	return r.DB.Create(&images).Error
}

func (r *WorkRepository) DeleteImage(imageID uint) error {
	return r.DB.Delete(&model.WorkImage{}, imageID).Error
}

func (r *WorkRepository) UpdateImageOrder(workID uint, imageIDs []uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		for idx, imageID := range imageIDs {
			if err := tx.Model(&model.WorkImage{}).
				Where("id = ? AND work_id = ?", imageID, workID).
				Update("sort_order", idx).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *WorkRepository) FindImagesByWorkID(workID uint) ([]model.WorkImage, error) {
	var images []model.WorkImage
	err := r.DB.Where("work_id = ?", workID).Order("sort_order ASC").Find(&images).Error
	return images, err
}

func (r *WorkRepository) FindImageCount(workID uint) (int64, error) {
	var count int64
	err := r.DB.Model(&model.WorkImage{}).Where("work_id = ?", workID).Count(&count).Error
	return count, err
}

func (r *WorkRepository) FindFirstOrDefaultImage(workID uint) (*model.WorkImage, error) {
	var image model.WorkImage
	err := r.DB.Where("work_id = ?", workID).Order("sort_order ASC").First(&image).Error
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func (r *WorkRepository) FindByCollectionID(collectionID uint, params map[string]interface{}, page, pageSize int) ([]model.Work, int64, error) {
	var works []model.Work
	var total int64

	query := r.DB.Model(&model.Work{}).
		Joins("JOIN collection_works ON collection_works.work_id = works.id").
		Where("collection_works.collection_id = ?", collectionID).
		Preload("Images", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Tags")

	if keyword, ok := params["keyword"].(string); ok && keyword != "" {
		query = query.Where("works.title LIKE ? OR works.description LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if tagIDs, ok := params["tag_ids"].([]uint); ok && len(tagIDs) > 0 {
		query = query.Joins("JOIN work_tags ON work_tags.work_id = works.id").
			Where("work_tags.tag_id IN ?", tagIDs).
			Group("works.id")
	}

	if ratingMin, ok := params["rating_min"].(int); ok {
		query = query.Where("works.rating >= ?", ratingMin)
	}

	if ratingMax, ok := params["rating_max"].(int); ok {
		query = query.Where("works.rating <= ?", ratingMax)
	}

	if isPublic, ok := params["is_public"].(bool); ok {
		query = query.Where("works.is_public = ?", isPublic)
	}

	result := query.Count(&total)
	if result.Error != nil {
		return nil, 0, result.Error
	}

	offset := (page - 1) * pageSize
	if err := query.Order("collection_works.sort_order ASC").Offset(offset).Limit(pageSize).Find(&works).Error; err != nil {
		return nil, 0, err
	}

	return works, total, nil
}

func (r *WorkRepository) Count() (int64, error) {
	var count int64
	err := r.DB.Model(&model.Work{}).Count(&count).Error
	return count, err
}

func (r *WorkRepository) FindAllImages() ([]model.WorkImage, error) {
	var images []model.WorkImage
	err := r.DB.Model(&model.WorkImage{}).
		Select("storage_path, created_at").
		Order("created_at ASC").
		Find(&images).Error
	return images, err
}
