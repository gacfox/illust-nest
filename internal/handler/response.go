package handler

import (
	"illust-nest/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func Error(c *gin.Context, code int, message string) {
	statusCode := http.StatusOK
	if code >= 4000 {
		statusCode = http.StatusInternalServerError
	} else if code >= 3000 {
		statusCode = http.StatusBadRequest
	} else if code >= 2000 {
		statusCode = http.StatusUnauthorized
	} else if code >= 1000 {
		statusCode = http.StatusBadRequest
	}

	c.JSON(statusCode, Response{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

func BadRequest(c *gin.Context, message string) {
	Error(c, 1001, message)
}

func NotFound(c *gin.Context) {
	Error(c, 1002, "resource not found")
}

func Conflict(c *gin.Context, message string) {
	Error(c, 1003, message)
}

func Unauthorized(c *gin.Context) {
	Error(c, 2001, "unauthorized")
}

func UnauthorizedWithMessage(c *gin.Context, message string) {
	Error(c, 2001, message)
}

func Forbidden(c *gin.Context) {
	Error(c, 2002, "forbidden")
}

func SystemNotInitialized(c *gin.Context) {
	Error(c, 3001, "system not initialized")
}

func SystemAlreadyInitialized(c *gin.Context) {
	Error(c, 3002, "system already initialized")
}

func PublicGalleryDisabled(c *gin.Context) {
	Error(c, 3003, "public gallery is disabled")
}

func InternalError(c *gin.Context) {
	Error(c, 5001, "internal server error")
}

func InternalErrorWithMessage(c *gin.Context, message string) {
	Error(c, 5001, message)
}

func ValidationErrorWithType(c *gin.Context, err *service.ValidationError) {
	Error(c, err.Code, err.Message)
}
