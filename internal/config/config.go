package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	JWT       JWTConfig       `yaml:"jwt"`
	Upload    UploadConfig    `yaml:"upload"`
	Thumbnail ThumbnailConfig `yaml:"thumbnail"`
	Web       WebConfig       `yaml:"web"`
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

type UploadConfig struct {
	MaxFileSize    int64    `yaml:"max_file_size"`
	AllowedFormats []string `yaml:"allowed_formats"`
}

type ThumbnailConfig struct {
	MaxWidth int `yaml:"max_width"`
	Quality  int `yaml:"quality"`
}

type WebConfig struct {
	StaticDir string `yaml:"static_dir"`
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

	return nil
}
