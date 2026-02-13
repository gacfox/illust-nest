package repository

import (
	"illust-nest/internal/model"

	"gorm.io/gorm"
)

type SettingRepository struct {
	DB *gorm.DB
}

func NewSettingRepository(db *gorm.DB) *SettingRepository {
	return &SettingRepository{DB: db}
}

func (r *SettingRepository) Get(key string) (*model.Setting, error) {
	var setting model.Setting
	err := r.DB.Where("key = ?", key).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *SettingRepository) Set(key, value string) error {
	setting := &model.Setting{Key: key, Value: value}
	return r.DB.Save(setting).Error
}

func (r *SettingRepository) GetAll() ([]model.Setting, error) {
	var settings []model.Setting
	err := r.DB.Find(&settings).Error
	return settings, err
}