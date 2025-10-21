package model

import "time"

type Task struct {
	ID             uint          `gorm:"primaryKey" json:"id" autoIncrement:"true"`
	Title          string        `gorm:"not null" json:"title"`
	Description    string        `gorm:"type:text" json:"description"`
	CreatedBy      uint          `gorm:"not null" json:"-"`
	CreatedByUser  User          `gorm:"foreignKey:CreatedBy" json:"created_by"`
	AssignedLeader uint          `json:"-"`
	LeaderUser     User          `gorm:"foreignKey:AssignedLeader" json:"assigned_leader"`
	Status         string        `gorm:"type:enum('Submitted', 'Revision', 'Approved by Leader', 'In Progress', 'Completed');default:'Submitted';not null" json:"status"`
	Progress       int           `gorm:"default:0;not null" json:"progress"`
	ProgressBy     uint          `json:"-"`
	ProgressUser   User          `gorm:"foreignKey:ProgressBy" json:"progress_by"`
	Deadline       time.Time     `json:"deadline"`
	TaskHistories  []TaskHistory `gorm:"foreignKey:TaskID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"histories"`
}
