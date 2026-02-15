package router

import (
	"illust-nest/internal/config"
	"illust-nest/internal/database"
	"illust-nest/internal/handler"
	"illust-nest/internal/middleware"
	"illust-nest/internal/repository"
	"illust-nest/internal/service"
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
	imageService := service.NewImageService()
	workService := service.NewWorkService(workRepo, tagRepo, imageService)
	return handler.NewWorkHandler(workService, imageService)
}

func setupPublic() *handler.PublicHandler {
	workRepo := repository.NewWorkRepository(database.DB)
	tagRepo := repository.NewTagRepository(database.DB)
	imageService := service.NewImageService()
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
	serveImage(c, filepath.Join(service.UploadBaseDir(), "originals"), c.Param("filepath"))
}

func serveThumbnailImage(c *gin.Context) {
	serveImage(c, filepath.Join(service.UploadBaseDir(), "thumbnails"), c.Param("filepath"))
}

func serveTranscodedImage(c *gin.Context) {
	serveImage(c, filepath.Join(service.UploadBaseDir(), "transcoded"), c.Param("filepath"))
}

func serveImage(c *gin.Context, rootDir, rawPath string) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(rawPath, "/"))
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	rootAbs, err := filepath.Abs(filepath.Clean(rootDir))
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	candidate := filepath.Join(rootAbs, filepath.FromSlash(cleaned))
	candidateAbs, err := filepath.Abs(candidate)
	if err != nil || (candidateAbs != rootAbs && !strings.HasPrefix(candidateAbs, rootAbs+string(os.PathSeparator))) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	fileInfo, err := os.Stat(candidateAbs)
	if err != nil || fileInfo.IsDir() {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.FileAttachment(candidateAbs, "")
	c.Header("Cache-Control", "max-age=31536000")
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
