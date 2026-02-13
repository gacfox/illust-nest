package main

import (
	"fmt"
	"illust-nest/internal/config"
	"illust-nest/internal/database"
	"illust-nest/internal/router"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	configEnv := os.Getenv("GIN_MODE")
	if configEnv == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	configFile := "./config/config.dev.yaml"
	if configEnv == "release" {
		configFile = "./config/config.prod.yaml"
	}
	if customConfig := os.Getenv("CONFIG_FILE"); customConfig != "" {
		configFile = customConfig
	}

	if err := config.Load(configFile); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := database.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	if err := database.AutoMigrate(); err != nil {
		log.Fatalf("Failed to run auto migration: %v", err)
	}

	if err := database.InitializeDefaultData(); err != nil {
		log.Fatalf("Failed to initialize default data: %v", err)
	}

	r := router.Setup()

	addr := fmt.Sprintf(":%d", config.GlobalConfig.Server.Port)
	log.Printf("Starting server on %s", addr)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}