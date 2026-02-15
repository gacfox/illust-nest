package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	Web      WebConfig      `yaml:"web"`
	Storage  StorageConfig  `yaml:"storage"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Driver string `yaml:"driver"`
	Path   string `yaml:"path"`
}

type JWTConfig struct {
	Secret      string `yaml:"secret"`
	ExpireHours int    `yaml:"expire_hours"`
}

type WebConfig struct {
	StaticDir string `yaml:"static_dir"`
}

type StorageConfig struct {
	Main       string                `yaml:"main"`
	Backup     string                `yaml:"backup"`
	BackupMode string                `yaml:"backup_mode"`
	Providers  []StorageProviderItem `yaml:"providers"`
}

type StorageProviderItem struct {
	Name string `yaml:"name"`
	Type string `yaml:"type"`

	UploadBaseDir string `yaml:"upload_base_dir"`

	Endpoint        string `yaml:"endpoint"`
	Region          string `yaml:"region"`
	Bucket          string `yaml:"bucket"`
	AccessKeyID     string `yaml:"access_key_id"`
	SecretAccessKey string `yaml:"secret_access_key"`
	UseSSL          bool   `yaml:"use_ssl"`
	ForcePathStyle  bool   `yaml:"force_path_style"`
	Prefix          string `yaml:"prefix"`
}

var GlobalConfig Config

func Load(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	if err := yaml.Unmarshal(data, &GlobalConfig); err != nil {
		return fmt.Errorf("failed to parse config file: %w", err)
	}

	if GlobalConfig.Web.StaticDir == "" {
		GlobalConfig.Web.StaticDir = "./frontend/dist"
	}
	if len(GlobalConfig.Storage.Providers) == 0 {
		GlobalConfig.Storage.Providers = []StorageProviderItem{
			{
				Name:          "local",
				Type:          "local",
				UploadBaseDir: "./data/uploads",
			},
		}
	}
	if GlobalConfig.Storage.Main == "" {
		GlobalConfig.Storage.Main = "local"
	}
	if GlobalConfig.Storage.BackupMode == "" {
		GlobalConfig.Storage.BackupMode = "write_only"
	}
	for i := range GlobalConfig.Storage.Providers {
		provider := &GlobalConfig.Storage.Providers[i]
		if provider.Type == "local" && provider.UploadBaseDir == "" {
			provider.UploadBaseDir = "./data/uploads"
		}
		if provider.Type == "s3" && provider.Region == "" {
			provider.Region = "us-east-1"
		}
	}
	if GlobalConfig.Storage.BackupMode != "write_only" && GlobalConfig.Storage.BackupMode != "mirror" {
		return fmt.Errorf("invalid storage.backup_mode: %s (allowed: write_only, mirror)", GlobalConfig.Storage.BackupMode)
	}

	return nil
}
