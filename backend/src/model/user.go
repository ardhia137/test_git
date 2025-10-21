package model

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id" autoIncrement:"true"`
	Username string `gorm:"unique;not null" json:"username"`
	Password string `gorm:"not null" json:"-"`
	Role     string `gorm:"type:enum('pelaksana', 'leader', 'manager');default:'pelaksana';not null"`
}
