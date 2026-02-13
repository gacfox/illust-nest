package database

import (
	"fmt"
	"illust-nest/internal/config"
	"illust-nest/internal/model"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func openPureGoSQLite(dsn string) (*gorm.DB, error) {
	dialector := sqlite.Dialector{
		DSN:        dsn,
		DriverName: "sqlite",
	}
	return gorm.Open(&dialector, &gorm.Config{})
}

var DB *gorm.DB

func ensureSQLiteDir(dsn string) error {
	if dsn == "" {
		return nil
	}

	if strings.Contains(dsn, ":memory:") {
		return nil
	}

	path := dsn
	if after, ok := strings.CutPrefix(path, "file:"); ok {
		path = after
	}
	if idx := strings.Index(path, "?"); idx >= 0 {
		path = path[:idx]
	}
	if path == "" {
		return nil
	}

	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		return nil
	}

	return os.MkdirAll(dir, 0755)
}

func Init() error {
	var err error
	if err := ensureSQLiteDir(config.GlobalConfig.Database.Path); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}
	DB, err = openPureGoSQLite(config.GlobalConfig.Database.Path)
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return nil
}

func AutoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
		&model.Setting{},
		&model.Tag{},
		&model.Work{},
		&model.WorkImage{},
		&model.WorkTag{},
		&model.Collection{},
		&model.CollectionWork{},
	)
}

func InitializeDefaultData() error {
	setting := &model.Setting{Key: "initialized", Value: "false"}
	if err := DB.Where("key = ?", setting.Key).First(setting).Error; err != gorm.ErrRecordNotFound {
		if err != nil {
			return err
		}
		if setting.Value == "true" {
			return nil
		}
		return nil
	}

	transaction := DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			transaction.Rollback()
		}
	}()

	if err := transaction.FirstOrCreate(&model.Setting{Key: "initialized", Value: "false"}, model.Setting{Key: "initialized"}).Error; err != nil {
		transaction.Rollback()
		return err
	}

	if err := transaction.Create(&model.Setting{Key: "public_gallery_enabled", Value: "false"}).Error; err != nil {
		transaction.Rollback()
		return err
	}

	if err := transaction.Create(&model.Setting{Key: "site_title", Value: "Illust Nest"}).Error; err != nil {
		transaction.Rollback()
		return err
	}

	systemTags := []model.Tag{
		{Name: "AI", IsSystem: true},
		{Name: "R18", IsSystem: true},
		{Name: "R18G", IsSystem: true},
	}
	for _, tag := range systemTags {
		if err := transaction.FirstOrCreate(&tag, model.Tag{Name: tag.Name}).Error; err != nil {
			transaction.Rollback()
			return err
		}
	}

	return transaction.Commit().Error
}
