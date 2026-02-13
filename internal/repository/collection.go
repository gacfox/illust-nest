package repository

import (
	"illust-nest/internal/model"

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
	err := r.DB.Where("parent_id IS NULL").Order("sort_order ASC").Find(&collections).Error
	return collections, err
}

func (r *CollectionRepository) FindTree(parentID *uint) ([]model.Collection, error) {
	var collections []model.Collection
	query := r.DB.Order("sort_order ASC")

	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	err := query.Find(&collections).Error
	if err != nil {
		return nil, err
	}

	for i := range collections {
		var count int64
		r.DB.Model(&model.CollectionWork{}).Where("collection_id = ?", collections[i].ID).Count(&count)
		collections[i].WorkCount = int(count)

		subcollections, err := r.FindTree(&collections[i].ID)
		if err != nil {
			return nil, err
		}
		collections[i].SubCollections = subcollections
	}

	return collections, nil
}

func (r *CollectionRepository) FindPath(id uint) ([]model.Collection, error) {
	var path []model.Collection
	currentID := id

	for {
		var collection model.Collection
		err := r.DB.First(&collection, currentID).Error
		if err != nil {
			return nil, err
		}

		path = append([]model.Collection{collection}, path...)

		if collection.ParentID == nil {
			break
		}
		currentID = *collection.ParentID
	}

	return path, nil
}

func (r *CollectionRepository) Update(collection *model.Collection) error {
	return r.DB.Save(collection).Error
}

func (r *CollectionRepository) Delete(id uint, recursive bool) error {
	if !recursive {
		var count int64
		r.DB.Model(&model.Collection{}).Where("parent_id = ?", id).Count(&count)
		if count > 0 {
			return gorm.ErrRecordNotFound
		}
	}

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

func (r *CollectionRepository) UpdateSortOrder(parentID *uint, collectionIDs []uint) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		for idx, collectionID := range collectionIDs {
			if err := tx.Model(&model.Collection{}).
				Where("id = ?", collectionID).
				Update("sort_order", idx).Error; err != nil {
				return err
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

func (r *CollectionRepository) GetDescendants(id uint) ([]model.Collection, error) {
	var descendants []model.Collection
	err := r.DB.Raw(`
		WITH RECURSIVE descendant_tree AS (
			SELECT * FROM t_collection WHERE id = ?
			UNION ALL
			SELECT c.* FROM t_collection c
			JOIN descendant_tree dt ON c.parent_id = dt.id
		)
		SELECT * FROM descendant_tree WHERE id != ?
	`, id, id).Scan(&descendants).Error
	return descendants, err
}

func (r *CollectionRepository) Count() (int64, error) {
	var count int64
	err := r.DB.Model(&model.Collection{}).Count(&count).Error
	return count, err
}
