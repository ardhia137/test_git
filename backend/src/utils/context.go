package utils

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetUserIDFromContext(c *gin.Context) (uint, error) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return 0, errors.New("user ID not found in token")
	}

	userIDFloat, ok := userID.(float64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID type"})
		return 0, errors.New("invalid user ID type")
	}

	return uint(userIDFloat), nil
}

func GetUsernameFromContext(c *gin.Context) (string, error) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username not found in token"})
		return "", errors.New("username not found in token")
	}

	usernameStr, ok := username.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid username type"})
		return "", errors.New("invalid username type")
	}

	return usernameStr, nil
}

func GetRoleFromContext(c *gin.Context) (string, error) {
	role, exists := c.Get("role")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in token"})
		return "", errors.New("role not found in token")
	}

	roleStr, ok := role.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid role type"})
		return "", errors.New("invalid role type")
	}

	return roleStr, nil
}
