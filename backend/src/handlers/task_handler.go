package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/ardhia137/task_todo/src/database"
	"github.com/ardhia137/task_todo/src/model"
	"github.com/ardhia137/task_todo/src/utils"
	"github.com/gin-gonic/gin"
)

func CreateTaskHandler(c *gin.Context) {
	var req model.TaskRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy, err := utils.GetUserIDFromContext(c)
	if err != nil {
		return
	}

	dueDate, err := time.Parse("2006-01-02 15:04:05.000", req.DueDate)
	if err != nil {
		fmt.Println("Error parsing date:", err)
	}

	task := model.Task{
		Title:          req.Title,
		Description:    req.Description,
		CreatedBy:      createdBy,
		AssignedLeader: req.AssigneeID,
		Status:         "Submitted",
		Progress:       0,
		ProgressBy:     createdBy,
		Deadline:       dueDate,
	}
	tx := database.DB.Begin()
	if err := tx.Create(&task).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	history := model.TaskHistory{
		TaskID:   task.ID,
		ActionBy: createdBy,
		Action:   "submit",
	}

	if err := tx.Create(&history).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task history"})
		return
	}

	tx.Commit()

	if err := database.DB.Preload("TaskHistories").First(&task, task.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load task with history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task created successfully",
		"task":    task,
	})
}

func GetTasksHandler(c *gin.Context) {
	user_id, err := utils.GetUserIDFromContext(c)

	if err != nil {
		return
	}
	var tasks []model.Task
	if err := database.DB.
		Preload("CreatedByUser").
		Preload("LeaderUser").
		Preload("ProgressUser").
		Preload("TaskHistories.ActionUser").
		Where("created_by = ?", user_id).
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
	})
}

func UpdateTask(c *gin.Context) {
	var req model.TaskRequest

	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	updatedBy, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var existingTask model.Task
	if err := database.DB.First(&existingTask, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if existingTask.Status != "Revision" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Task cannot be updated because status is '%s'", existingTask.Status),
		})
		return
	}

	dueDate, err := time.Parse("2006-01-02 15:04:05.000", req.DueDate)
	if err != nil {
		fmt.Println("Error parsing date:", err)
	}

	updateData := model.Task{
		Title:          req.Title,
		Description:    req.Description,
		CreatedBy:      uint(updatedBy),
		AssignedLeader: req.AssigneeID,
		Status:         "Submitted",
		Progress:       0,
		ProgressBy:     uint(updatedBy),
		Deadline:       dueDate,
	}

	if err := database.DB.Model(&existingTask).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	history := model.TaskHistory{
		TaskID:   existingTask.ID,
		ActionBy: uint(updatedBy),
		Action:   "submit",
	}
	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record history"})
		return
	}

	var updatedTask model.Task
	if err := database.DB.Preload("TaskHistories").First(&updatedTask, existingTask.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load updated task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task updated successfully",
		"task":    updatedTask,
	})
}

func UpdateProgress(c *gin.Context) {
	var req struct {
		Progress int    `json:"progress" binding:"required"`
		Note     string `json:"note"`
	}

	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	updatedBy, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var existingTask model.Task
	if err := database.DB.First(&existingTask, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if existingTask.Status != "Approved by Leader" && existingTask.Status != "In Progress" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Task cannot be updated because status is '%s'", existingTask.Status),
		})
		return
	}

	newStatus := existingTask.Status
	if req.Progress == 100 {
		newStatus = "Completed"
	} else if req.Progress > 0 {
		newStatus = "In Progress"
	}

	if err := database.DB.Model(&existingTask).Updates(model.Task{
		Progress:   req.Progress,
		ProgressBy: uint(updatedBy),
		Status:     newStatus,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task progress"})
		return
	}
	newAction := "update_progress"
	if req.Progress == 100 {
		newAction = "complete"
	}
	if req.Note == "" {
		req.Note = fmt.Sprintf("Progress updated to %d%%", req.Progress)
	}

	history := model.TaskHistory{
		TaskID:   existingTask.ID,
		ActionBy: uint(updatedBy),
		Action:   newAction,
		Note:     req.Note,
	}
	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record history"})
		return
	}

	var updatedTask model.Task
	if err := database.DB.Preload("TaskHistories").First(&updatedTask, existingTask.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load updated task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task progress updated successfully",
		"task":    updatedTask,
	})
}

func GetTaskByLeaderId(c *gin.Context) {

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	leaderID, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var tasks []model.Task

	if err := database.DB.
		Preload("CreatedByUser").
		Preload("LeaderUser").
		Preload("ProgressUser").
		Preload("TaskHistories.ActionUser").
		Where("assigned_leader = ? AND status IN ?", leaderID, []string{"Submitted", "In Progress"}).
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
	})
}

func RevisionTask(c *gin.Context) {
	var req struct {
		Note string `json:"note" binding:"required"`
	}

	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	leaderID, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var existingTask model.Task
	if err := database.DB.First(&existingTask, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if existingTask.Status != "Submitted" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Task cannot be revised because status is '%s'", existingTask.Status),
		})
		return
	}

	if err := database.DB.Model(&existingTask).Updates(model.Task{
		Status: "Revision",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task status"})
		return
	}

	history := model.TaskHistory{
		TaskID:   existingTask.ID,
		ActionBy: uint(leaderID),
		Action:   "revision",
		Note:     req.Note,
	}
	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record history"})
		return
	}

	var updatedTask model.Task
	if err := database.DB.Preload("TaskHistories").First(&updatedTask, existingTask.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load updated task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task revised successfully",
		"task":    updatedTask,
	})
}

func ApproveTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	leaderID, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var existingTask model.Task
	if err := database.DB.First(&existingTask, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if existingTask.Status != "Submitted" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Task cannot be approved because status is '%s'", existingTask.Status),
		})
		return
	}

	if err := database.DB.Model(&existingTask).Updates(model.Task{
		Status: "Approved by Leader",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task status"})
		return
	}

	history := model.TaskHistory{
		TaskID:   existingTask.ID,
		ActionBy: uint(leaderID),
		Action:   "approve",
	}
	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record history"})
		return
	}

	var updatedTask model.Task
	if err := database.DB.Preload("TaskHistories").First(&updatedTask, existingTask.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load updated task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task approved successfully",
		"task":    updatedTask,
	})
}

func ProgressOverride(c *gin.Context) {
	var req struct {
		Progress int    `json:"progress" binding:"required"`
		Note     string `json:"note"`
	}

	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	leaderID, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return
	}

	var existingTask model.Task
	if err := database.DB.First(&existingTask, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	newStatus := existingTask.Status
	if req.Progress == 100 {
		newStatus = "Completed"
	} else if req.Progress > 0 {
		newStatus = "In Progress"
	}

	if err := database.DB.Model(&existingTask).Updates(model.Task{
		Progress:   req.Progress,
		ProgressBy: uint(leaderID),
		Status:     newStatus,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task progress"})
		return
	}
	newAction := "update_progress"
	if req.Progress == 100 {
		newAction = "complete"
	}
	if req.Note == "" {
		req.Note = fmt.Sprintf("Progress overridden to %d%%", req.Progress)
	}

	history := model.TaskHistory{
		TaskID:   existingTask.ID,
		ActionBy: uint(leaderID),
		Action:   newAction,
		Note:     req.Note,
	}
	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record history"})
		return
	}

	var updatedTask model.Task
	if err := database.DB.Preload("TaskHistories").First(&updatedTask, existingTask.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load updated task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task progress overridden successfully",
		"task":    updatedTask,
	})
}

func GetTaskManager(c *gin.Context) {
	var tasks []model.Task

	if err := database.DB.
		Preload("CreatedByUser").
		Preload("LeaderUser").
		Preload("ProgressUser").
		Preload("TaskHistories.ActionUser").
		Where("status IN ?", []string{"Approved by Leader", "In Progress", "Completed"}).
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tasks": tasks})
}

func GetLeader(c *gin.Context) {
	var leaders []model.User

	if err := database.DB.Where("role = ?", "leader").Find(&leaders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve leaders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"leaders": leaders})
}

func DeleteTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	if err := database.DB.Delete(&model.Task{}, taskID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Task deleted successfully",
	})
}
