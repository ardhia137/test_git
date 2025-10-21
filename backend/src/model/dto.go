package model

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	Role  string `json:"role"`
}

type TaskRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	AssigneeID  uint   `json:"assignee_id" binding:"required"`
	DueDate     string `json:"due_date"`
}
