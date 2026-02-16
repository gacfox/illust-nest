package middleware

import (
	"net/http"

	"illust-nest/internal/repository"

	"github.com/gin-gonic/gin"
)

func PublicGalleryEnabled(settingRepo *repository.SettingRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		if settingRepo == nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		enabled, err := settingRepo.Get("public_gallery_enabled")
		if err != nil || enabled.Value != "true" {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		c.Next()
	}
}
