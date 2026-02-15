package router

import (
	"context"
	"illust-nest/internal/config"
	"illust-nest/internal/database"
	"illust-nest/internal/handler"
	"illust-nest/internal/middleware"
	"illust-nest/internal/repository"
	"illust-nest/internal/service"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
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
	publicHandler := setupPublic()
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
		system.GET("/statistics", middleware.Auth(), systemHandler.GetStatistics)
		system.GET("/imagemagick/test", middleware.Auth(), systemHandler.TestImageMagick)
	}

	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.GET("/me", middleware.Auth(), authHandler.Me)
		auth.PUT("/password", middleware.Auth(), authHandler.ChangePassword)
		auth.POST("/refresh", middleware.Auth(), authHandler.RefreshToken)
	}

	public := r.Group("/api/public")
	{
		publicWorks := public.Group("/works")
		{
			publicWorks.GET("", publicHandler.ListWorks)
			publicWorks.GET("/:id", publicHandler.GetWork)
		}

		publicImages := public.Group("/images")
		{
			publicImages.GET("/originals/*filepath", publicHandler.GetOriginalImage)
			publicImages.GET("/transcoded/*filepath", publicHandler.GetTranscodedImage)
			publicImages.GET("/thumbnails/*filepath", publicHandler.GetThumbnailImage)
		}
	}

	api := r.Group("/api")
	api.Use(middleware.Auth())
	{
		works := api.Group("/works")
		{
			works.GET("", workHandler.List)
			works.GET("/export/images", workHandler.ExportImages)
			works.POST("/images/duplicates", workHandler.CheckDuplicateImages)
			works.POST("", workHandler.Create)
			works.GET("/:id/download", workHandler.DownloadImages)
			works.GET("/:id/images/:imageId/exif", workHandler.GetImageEXIF)
			works.GET("/:id", workHandler.Get)
			works.PUT("/:id", workHandler.Update)
			works.DELETE("/:id", workHandler.Delete)
			works.DELETE("/batch", workHandler.BatchDelete)
			works.PUT("/batch/public", workHandler.BatchUpdatePublic)
			works.POST("/:id/images", workHandler.AddImages)
			works.DELETE("/:id/images/:imageId", workHandler.DeleteImage)
			works.PUT("/:id/images/order", workHandler.UpdateImageOrder)
			works.PUT("/:id/images/:imageId/ai-metadata", workHandler.UpdateImageAIMetadata)
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
		images.GET("/transcoded/*filepath", serveTranscodedImage)
		images.GET("/thumbnails/*filepath", serveThumbnailImage)
	}

	r.NoRoute(serveFrontend)

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
	workRepo := repository.NewWorkRepository(database.DB)
	tagRepo := repository.NewTagRepository(database.DB)
	collectionRepo := repository.NewCollectionRepository(database.DB)
	authService := service.NewAuthService(userRepo)
	systemService := service.NewSystemService(
		settingRepo,
		userRepo,
		workRepo,
		tagRepo,
		collectionRepo,
		authService,
	)
	return handler.NewSystemHandler(systemService)
}

func setupWork() *handler.WorkHandler {
	workRepo := repository.NewWorkRepository(database.DB)
	tagRepo := repository.NewTagRepository(database.DB)
	settingRepo := repository.NewSettingRepository(database.DB)
	imageService := service.NewImageService(settingRepo)
	workService := service.NewWorkService(workRepo, tagRepo, imageService)
	return handler.NewWorkHandler(workService, imageService)
}

func setupPublic() *handler.PublicHandler {
	workRepo := repository.NewWorkRepository(database.DB)
	tagRepo := repository.NewTagRepository(database.DB)
	settingRepo := repository.NewSettingRepository(database.DB)
	imageService := service.NewImageService(settingRepo)
	workService := service.NewWorkService(workRepo, tagRepo, imageService)
	return handler.NewPublicHandler(workService)
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
	serveImage(c, "uploads/originals", c.Param("filepath"))
}

func serveThumbnailImage(c *gin.Context) {
	serveImage(c, "uploads/thumbnails", c.Param("filepath"))
}

func serveTranscodedImage(c *gin.Context) {
	serveImage(c, "uploads/transcoded", c.Param("filepath"))
}

func serveImage(c *gin.Context, logicalPrefix, rawPath string) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(rawPath, "/"))
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	logicalPath := logicalPrefix + "/" + cleaned

	storage, err := service.GetStorageProvider()
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	file, objectInfo, err := storage.Get(context.Background(), logicalPath)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer file.Close()
	if objectInfo.ContentType != "" {
		c.Header("Content-Type", objectInfo.ContentType)
	} else if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(logicalPath))); contentType != "" {
		c.Header("Content-Type", contentType)
	}
	c.Header("Cache-Control", "max-age=31536000")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, file)
}

func serveFrontend(c *gin.Context) {
	if strings.HasPrefix(c.Request.URL.Path, "/api/") {
		handler.NotFound(c)
		return
	}

	staticRoot := strings.TrimSpace(config.GlobalConfig.Web.StaticDir)
	if staticRoot == "" {
		staticRoot = "./frontend/dist"
	}

	staticRootAbs, err := filepath.Abs(staticRoot)
	if err != nil {
		c.String(http.StatusInternalServerError, "invalid web static directory")
		return
	}

	requestPath := strings.TrimPrefix(c.Request.URL.Path, "/")
	requestPath = filepath.Clean(requestPath)
	if requestPath == "." || requestPath == string(filepath.Separator) {
		requestPath = ""
	}

	if requestPath != "" {
		candidate := filepath.Join(staticRootAbs, requestPath)
		candidateAbs, absErr := filepath.Abs(candidate)
		if absErr == nil &&
			(candidateAbs == staticRootAbs || strings.HasPrefix(candidateAbs, staticRootAbs+string(os.PathSeparator))) {
			if stat, statErr := os.Stat(candidateAbs); statErr == nil && !stat.IsDir() {
				c.File(candidateAbs)
				return
			}
		}
	}

	indexPath := filepath.Join(staticRootAbs, "index.html")
	if _, statErr := os.Stat(indexPath); statErr != nil {
		c.String(http.StatusNotFound, "frontend index not found")
		return
	}
	c.File(indexPath)
}
