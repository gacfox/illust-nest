package model

import "time"

type Setting struct {
	Key       string    `gorm:"primaryKey;type:varchar(50)" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`
}
