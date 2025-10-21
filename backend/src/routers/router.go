package routers

import (
	"github.com/ardhia137/task_todo/src/handlers"
	"github.com/ardhia137/task_todo/src/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/login", handlers.LoginHandler)
	}

	leaderGroup := r.Group("/leader")
	leaderGroup.Use(middleware.AuthMiddleware(), middleware.RequirePelaksana())
	{
		leaderGroup.GET("/", handlers.GetLeader)
	}

	taskGroup := r.Group("/tasks")
	taskGroup.Use(middleware.AuthMiddleware())
	{

		pelaksanaGroup := taskGroup.Group("")
		pelaksanaGroup.Use(middleware.RequirePelaksana())
		{
			pelaksanaGroup.POST("/", handlers.CreateTaskHandler)
			pelaksanaGroup.GET("/", handlers.GetTasksHandler)
			pelaksanaGroup.PUT("/:id", handlers.UpdateTask)
			pelaksanaGroup.PUT("/:id/progress", handlers.UpdateProgress)
			pelaksanaGroup.DELETE("/:id", handlers.DeleteTask)
		}

		leaderGroup := taskGroup.Group("")
		leaderGroup.Use(middleware.RequireLeader())
		{
			leaderGroup.GET("/pending", handlers.GetTaskByLeaderId)
			leaderGroup.PUT("/:id/revise", handlers.RevisionTask)
			leaderGroup.PUT("/:id/approve", handlers.ApproveTask)
			leaderGroup.PUT("/:id/progress/override", handlers.ProgressOverride)
		}

		managerGroup := taskGroup.Group("")
		managerGroup.Use(middleware.RequireManager())
		{
			managerGroup.GET("/approved", handlers.GetTaskManager)
		}
	}

	return r
}
