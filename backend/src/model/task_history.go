package model

import "time"

type TaskHistory struct {
	ID         uint      `gorm:"primaryKey" json:"id" autoIncrement:"true"`
	TaskID     uint      `gorm:"not null;index" json:"task_id"`
	ActionBy   uint      `gorm:"not null" json:"-"`
	ActionUser User      `gorm:"foreignKey:ActionBy" json:"action_by"`
	Action     string    `gorm:"type:enum('submit', 'revision', 'approve', 'update_progress', 'complete');not null" json:"action"`
	Note       string    `gorm:"type:text" json:"note"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}
