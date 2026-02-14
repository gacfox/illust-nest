package router

import (
	"illust-nest/internal/config"
	"illust-nest/internal/database"
	"illust-nest/internal/handler"
	"illust-nest/internal/middleware"
	"illust-nest/internal/repository"
	"illust-nest/internal/service"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	if config.GlobalConfig.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())

	authHandler := setupAuth()
	systemHandler := setupSystem()
	workHandler := setupWork()
	tagHandler := setupTag()
	collectionHandler := setupCollection()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	system := r.Group("/api/system")
	{
		system.GET("/status", systemHandler.GetStatus)
		system.POST("/init", systemHandler.Init)
		system.GET("/settings", middleware.Auth(), systemHandler.GetSettings)
		system.PUT("/settings", middleware.Auth(), systemHandler.UpdateSettings)
	}

	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.GET("/me", middleware.Auth(), authHandler.Me)
		auth.PUT("/password", middleware.Auth(), authHandler.ChangePassword)
		auth.POST("/refresh", middleware.Auth(), authHandler.RefreshToken)
	}

	api := r.Group("/api")
	api.Use(middleware.Auth())
	{
		works := api.Group("/works")
		{
			works.GET("", workHandler.List)
			works.POST("", workHandler.Create)
			works.GET("/:id", workHandler.Get)
			works.PUT("/:id", workHandler.Update)
			works.DELETE("/:id", workHandler.Delete)
			works.DELETE("/batch", workHandler.BatchDelete)
			works.PUT("/batch/public", workHandler.BatchUpdatePublic)
			works.POST("/:id/images", workHandler.AddImages)
			works.DELETE("/:id/images/:imageId", workHandler.DeleteImage)
			works.PUT("/:id/images/order", workHandler.UpdateImageOrder)
		}

		tags := api.Group("/tags")
		{
			tags.GET("", tagHandler.List)
			tags.POST("", tagHandler.Create)
			tags.PUT("/:id", tagHandler.Update)
			tags.DELETE("/:id", tagHandler.Delete)
			tags.POST("/batch", tagHandler.BatchCreate)
		}

		collections := api.Group("/collections")
		{
			collections.GET("/tree", collectionHandler.Tree)
			collections.GET("/by-work/:workId", collectionHandler.GetByWork)
			collections.PUT("/by-work/:workId", collectionHandler.SyncByWork)
			collections.GET("/:id", collectionHandler.Get)
			collections.GET("/:id/works", collectionHandler.GetWorks)
			collections.POST("", collectionHandler.Create)
			collections.PUT("/:id", collectionHandler.Update)
			collections.DELETE("/:id", collectionHandler.Delete)
			collections.PUT("/order", collectionHandler.UpdateSortOrder)
			collections.POST("/:id/works", collectionHandler.AddWorks)
			collections.DELETE("/:id/works", collectionHandler.RemoveWorks)
			collections.PUT("/:id/works/order", collectionHandler.UpdateWorkSortOrder)
		}
	}

	images := r.Group("/api/images")
	images.Use(middleware.Auth())
	{
		images.GET("/originals/*filepath", serveOriginalImage)
		images.GET("/thumbnails/*filepath", serveThumbnailImage)
	}

	return r
}

func setupAuth() *handler.AuthHandler {
	userRepo := repository.NewUserRepository(database.DB)
	authService := service.NewAuthService(userRepo)
	return handler.NewAuthHandler(authService)
}

func setupSystem() *handler.SystemHandler {
	settingRepo := repository.NewSettingRepository(database.DB)
	userRepo := repository.NewUserRepository(database.DB)
	authService := service.NewAuthService(userRepo)
	systemService := service.NewSystemService(settingRepo, userRepo, authService)
	return handler.NewSystemHandler(systemService)
}

func setupWork() *handler.WorkHandler {
	workRepo := repository.NewWorkRepository(database.DB)
	tagRepo := repository.NewTagRepository(database.DB)
	imageService := service.NewImageService()
	workService := service.NewWorkService(workRepo, tagRepo, imageService)
	return handler.NewWorkHandler(workService, imageService)
}

func setupTag() *handler.TagHandler {
	tagRepo := repository.NewTagRepository(database.DB)
	tagService := service.NewTagService(tagRepo)
	return handler.NewTagHandler(tagService)
}

func setupCollection() *handler.CollectionHandler {
	collectionRepo := repository.NewCollectionRepository(database.DB)
	workRepo := repository.NewWorkRepository(database.DB)
	collectionService := service.NewCollectionService(collectionRepo, workRepo)
	return handler.NewCollectionHandler(collectionService)
}

func serveOriginalImage(c *gin.Context) {
	filepath := c.Param("filepath")
	fullPath := "./data/uploads/originals" + filepath
	serveImage(c, fullPath)
}

func serveThumbnailImage(c *gin.Context) {
	filepath := c.Param("filepath")
	fullPath := "./data/uploads/thumbnails" + filepath
	serveImage(c, fullPath)
}

func serveImage(c *gin.Context, fullPath string) {
	if !strings.HasPrefix(fullPath, "./data/uploads/") {
		c.String(http.StatusForbidden, "access denied")
		return
	}

	c.FileAttachment(fullPath, "")
	c.Header("Cache-Control", "max-age=31536000")
}
