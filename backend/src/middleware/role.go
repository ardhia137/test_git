package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		role, ok := userRole.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid role type"})
			c.Abort()
			return
		}
		for _, allowedRole := range allowedRoles {
			if role == allowedRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":          "Insufficient permissions",
			"required_roles": allowedRoles,
			"user_role":      role,
		})
		c.Abort()
	}
}

func RequirePelaksana() gin.HandlerFunc {
	return RequireRole("pelaksana")
}

func RequireLeader() gin.HandlerFunc {
	return RequireRole("leader")
}

func RequireManager() gin.HandlerFunc {
	return RequireRole("manager")
}

func RequireLeaderOrManager() gin.HandlerFunc {
	return RequireRole("leader", "manager")
}

func RequirePelaksanaOrLeader() gin.HandlerFunc {
	return RequireRole("pelaksana", "leader")
}
