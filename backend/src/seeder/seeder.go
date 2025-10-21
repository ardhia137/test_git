package seed

import (
	"log"

	"github.com/ardhia137/task_todo/src/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func SeedUsers(db *gorm.DB) {

	var n int64
	db.Model(&model.User{}).Count(&n)
	if n > 0 {
		return
	}

	users := []model.User{
		{Username: "pelaksana1", Role: "pelaksana"},
		{Username: "leader1", Role: "leader"},
		{Username: "manager1", Role: "manager"},
	}
	for i := range users {
		hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		users[i].Password = string(hash)
		if err := db.Create(&users[i]).Error; err != nil {
			log.Printf("seed user failed: %v", err)
		}
	}
	log.Println("seed users done. default password: password123")
}
