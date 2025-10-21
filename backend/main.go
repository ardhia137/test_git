package main

import (
	"fmt"
	"log"
	"os"

	"github.com/ardhia137/task_todo/src/database"
	"github.com/ardhia137/task_todo/src/model"
	"github.com/ardhia137/task_todo/src/routers"
	seed "github.com/ardhia137/task_todo/src/seeder"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	database.Connect()

	if err := database.DB.AutoMigrate(&model.User{}, &model.Task{}, &model.TaskHistory{}); err != nil {
		log.Fatalf("Error during auto-migration: %v", err)
	}
	seed.SeedUsers(database.DB)
	r := routers.SetupRouter()

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8082"
	}
	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
