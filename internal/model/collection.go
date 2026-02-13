package model

import "time"

type Collection struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	ParentID    *uint     `gorm:"index" json:"parent_id"`
	SortOrder   int       `gorm:"default:0;not null" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	SubCollections []Collection     `gorm:"foreignKey:ParentID" json:"sub_collections,omitempty"`
	CollectionWork []CollectionWork `gorm:"foreignKey:CollectionID" json:"-"`
	WorkCount      int              `gorm:"-" json:"work_count"`
}

type CollectionWork struct {
	CollectionID uint      `gorm:"primaryKey;not null" json:"collection_id"`
	WorkID       uint      `gorm:"primaryKey;not null" json:"work_id"`
	SortOrder    int       `gorm:"default:0;not null" json:"sort_order"`
	AddedAt      time.Time `gorm:"not null" json:"added_at"`
}
