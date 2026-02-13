package model

import "time"

type Tag struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	IsSystem  bool      `gorm:"default:false;not null" json:"is_system"`
	WorkCount int       `gorm:"-" json:"work_count,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
