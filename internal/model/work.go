package model

import "time"

type Work struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"type:varchar(200);not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Rating      int       `gorm:"default:0;not null" json:"rating"`
	IsPublic    bool      `gorm:"default:false;not null" json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Images     []WorkImage `gorm:"foreignKey:WorkID" json:"images"`
	Tags       []Tag       `gorm:"many2many:work_tags" json:"tags,omitempty"`
	CoverImage WorkImage   `gorm:"-" json:"cover_image,omitempty"`
	ImageCount int         `gorm:"-" json:"image_count,omitempty"`
}

type WorkImage struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	WorkID        uint      `gorm:"not null;index" json:"work_id"`
	StoragePath   string    `gorm:"type:varchar(255);not null" json:"storage_path"`
	ThumbnailPath string    `gorm:"type:varchar(255);not null" json:"thumbnail_path"`
	ImageHash     string    `gorm:"type:varchar(64);not null;default:'';index:idx_work_images_image_hash" json:"image_hash,omitempty"`
	FileSize      int64     `gorm:"not null" json:"file_size"`
	Width         int       `gorm:"not null" json:"width"`
	Height        int       `gorm:"not null" json:"height"`
	SortOrder     int       `gorm:"default:0;not null" json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
}

type WorkTag struct {
	WorkID uint `gorm:"primaryKey;not null" json:"work_id"`
	TagID  uint `gorm:"primaryKey;not null" json:"tag_id"`
}
