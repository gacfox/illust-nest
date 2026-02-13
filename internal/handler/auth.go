package handler

import (
	"illust-nest/internal/middleware"
	"illust-nest/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	resp, err := h.authService.Login(&req)
	if err != nil {
		UnauthorizedWithMessage(c, err.Error())
		return
	}

	Success(c, resp)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	user, err := h.authService.GetUserByID(userID.(uint))
	if err != nil {
		Unauthorized(c)
		return
	}

	Success(c, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"created_at": user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=100"`
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	if err := h.authService.ChangePassword(userID.(uint), req.OldPassword, req.NewPassword); err != nil {
		UnauthorizedWithMessage(c, err.Error())
		return
	}

	Success(c, nil)
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	username, exists := c.Get("username")
	if !exists {
		Unauthorized(c)
		return
	}

	token, expiresAt, err := middleware.GenerateToken(userID.(uint), username.(string))
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, gin.H{
		"token":      token,
		"expires_at": expiresAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}