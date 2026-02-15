package handler

import (
	"illust-nest/internal/service"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	systemService *service.SystemService
}

func NewSystemHandler(systemService *service.SystemService) *SystemHandler {
	return &SystemHandler{systemService: systemService}
}

func (h *SystemHandler) GetStatus(c *gin.Context) {
	status, err := h.systemService.GetStatus()
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, status)
}

func (h *SystemHandler) Init(c *gin.Context) {
	var req service.InitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	resp, err := h.systemService.Init(&req)
	if err != nil {
		if ve, ok := err.(*service.ValidationError); ok {
			Error(c, ve.Code, ve.Message)
		} else {
			InternalErrorWithMessage(c, err.Error())
		}
		return
	}

	Success(c, resp)
}

func (h *SystemHandler) GetSettings(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	_ = userID

	settings, err := h.systemService.GetSettings()
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, settings)
}

func (h *SystemHandler) UpdateSettings(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	_ = userID

	var req service.SystemSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, err.Error())
		return
	}

	if err := h.systemService.UpdateSettings(&req); err != nil {
		InternalError(c)
		return
	}

	Success(c, req)
}

func (h *SystemHandler) GetStatistics(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		Unauthorized(c)
		return
	}

	_ = userID

	stats, err := h.systemService.GetStatistics()
	if err != nil {
		InternalError(c)
		return
	}

	Success(c, stats)
}
