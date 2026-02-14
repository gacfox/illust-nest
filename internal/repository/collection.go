package repository

import (
	"errors"
	"illust-nest/internal/model"
	"time"

	"gorm.io/gorm"
)

type CollectionRepository struct {
	DB *gorm.DB
}

func NewCollectionRepository(db *gorm.DB) *CollectionRepository {
	return &CollectionRepository{DB: db}
}

func (r *CollectionRepository) Create(collection *model.Collection) error {
	return r.DB.Create(collection).Error
}

func (r *CollectionRepository) FindByID(id uint) (*model.Collection, error) {
	var collection model.Collection
	err := r.DB.First(&collection, id).Error
	if err != nil {
		return nil, err
	}

	var count int64
	r.DB.Model(&model.CollectionWork{}).Where("collection_id = ?", id).Count(&count)
	collection.WorkCount = int(count)

	return &collection, nil
}

func (r *CollectionRepository) FindAll() ([]model.Collection, error) {
	var collections []model.Collection
	err := r.DB.Order("sort_order ASC").Find(&collections).Error
	return collections, err
}

func (r *CollectionRepository) FindTree(parentID *uint) ([]model.Collection, error) {
	if parentID != nil {
		return []model.Collection{}, nil
	}

	var collections []model.Collection
	err := r.DB.Order("sort_order ASC").Find(&collections).Error
	if err != nil {
		return nil, err
	}

	for i := range collections {
		var count int64
		r.DB.Model(&model.CollectionWork{}).Where("collection_id = ?", collections[i].ID).Count(&count)
		collections[i].WorkCount = int(count)
	}

	return collections, nil
}

func (r *CollectionRepository) FindPath(id uint) ([]model.Collection, error) {
	var collection model.Collection
	if err := r.DB.First(&collection, id).Error; err != nil {
		return nil, err
	}
	return []model.Collection{collection}, nil
}

func (r *CollectionRepository) Update(collection *model.Collection) error {
	return r.DB.Save(collection).Error
}

func (r *CollectionRepository) Delete(id uint, _ bool) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("collection_id = ?", id).Delete(&model.CollectionWork{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Collection{}, id).Error
	})
}

func (r *CollectionRepository) AddWorks(collectionID uint, workIDs []uint) (int64, int64, error) {
	var addedCount int64
	var skippedCount int64

	for _, workID := range workIDs {
		var existing model.CollectionWork
		err := r.DB.Where("collection_id = ? AND work_id = ?", collectionID, workID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			var maxSortOrder int
			r.DB.Model(&model.CollectionWork{}).
				Where("collection_id = ?", collectionID).
				Select("COALESCE(MAX(sort_order), 0)").
				Scan(&maxSortOrder)

			if err := r.DB.Create(&model.CollectionWork{
				CollectionID: collectionID,
				WorkID:       workID,
				SortOrder:    maxSortOrder + 1,
			}).Error; err != nil {
				return addedCount, skippedCount, err
			}
			addedCount++
		} else if err != nil {
			return addedCount, skippedCount, err
		} else {
			skippedCount++
		}
	}

	return addedCount, skippedCount, nil
}

func (r *CollectionRepository) RemoveWorks(collectionID uint, workIDs []uint) (int64, error) {
	result := r.DB.Where("collection_id = ? AND work_id IN ?", collectionID, workIDs).Delete(&model.CollectionWork{})
	return result.RowsAffected, result.Error
}

func (r *CollectionRepository) ReplaceWorkCollections(workID uint, collectionIDs []uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("work_id = ?", workID).Delete(&model.CollectionWork{}).Error; err != nil {
			return err
		}

		if len(collectionIDs) == 0 {
			return nil
		}

		seen := make(map[uint]struct{}, len(collectionIDs))
		for _, collectionID := range collectionIDs {
			if _, ok := seen[collectionID]; ok {
				continue
			}
			seen[collectionID] = struct{}{}

			var maxSortOrder int
			if err := tx.Model(&model.CollectionWork{}).
				Where("collection_id = ?", collectionID).
				Select("COALESCE(MAX(sort_order), 0)").
				Scan(&maxSortOrder).Error; err != nil {
				return err
			}

			if err := tx.Create(&model.CollectionWork{
				CollectionID: collectionID,
				WorkID:       workID,
				SortOrder:    maxSortOrder + 1,
				AddedAt:      time.Now(),
			}).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *CollectionRepository) UpdateSortOrder(parentID *uint, collectionIDs []uint) error {
	if parentID != nil {
		return errors.New("flat collections only: parent_id is not supported")
	}

	return r.DB.Transaction(func(tx *gorm.DB) error {
		for idx, collectionID := range collectionIDs {
			result := tx.Model(&model.Collection{}).Where("id = ?", collectionID).Update("sort_order", idx)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return errors.New("collection not in target level")
			}
		}
		return nil
	})
}

func (r *CollectionRepository) UpdateWorkSortOrder(collectionID uint, workIDs []uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		for idx, workID := range workIDs {
			if err := tx.Model(&model.CollectionWork{}).
				Where("collection_id = ? AND work_id = ?", collectionID, workID).
				Update("sort_order", idx).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *CollectionRepository) Count() (int64, error) {
	var count int64
	err := r.DB.Model(&model.Collection{}).Count(&count).Error
	return count, err
}

func (r *CollectionRepository) FindByWorkID(workID uint) ([]model.Collection, error) {
	var collectionIDs []uint
	if err := r.DB.Model(&model.CollectionWork{}).
		Where("work_id = ?", workID).
		Pluck("collection_id", &collectionIDs).Error; err != nil {
		return nil, err
	}

	if len(collectionIDs) == 0 {
		return []model.Collection{}, nil
	}

	var collections []model.Collection
	if err := r.DB.Where("id IN ?", collectionIDs).Order("sort_order ASC").Find(&collections).Error; err != nil {
		return nil, err
	}

	for i := range collections {
		var count int64
		r.DB.Model(&model.CollectionWork{}).Where("collection_id = ?", collections[i].ID).Count(&count)
		collections[i].WorkCount = int(count)
	}

	return collections, nil
}
