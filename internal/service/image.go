package service

import (
	"crypto/rand"
	"errors"
	"fmt"
	"illust-nest/internal/config"
	"illust-nest/internal/repository"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	MaxUploadFileSizeMB    int64 = 20
	MaxUploadFileSizeBytes       = MaxUploadFileSizeMB * 1024 * 1024
	thumbnailMaxWidth            = 400
	thumbnailQuality             = 85
)

var allowedUploadFormats = map[string]struct{}{
	"image/jpeg":              {},
	"image/png":               {},
	"image/gif":               {},
	"image/webp":              {},
	"image/bmp":               {},
	"image/x-ms-bmp":          {},
	"image/tiff":              {},
	"image/psd":               {},
	"image/x-psd":             {},
	"image/photoshop":         {},
	"image/x-photoshop":       {},
	"application/photoshop":   {},
	"application/x-photoshop": {},
	"application/psd":         {},
	"application/postscript":  {},
	"application/illustrator": {},
	"image/heic":              {},
	"image/heif":              {},
	"image/avif":              {},
}

const logicalUploadPrefix = "uploads/"

type ImageService struct {
	settingRepo *repository.SettingRepository
}

func NewImageService(settingRepo *repository.SettingRepository) *ImageService {
	return &ImageService{settingRepo: settingRepo}
}

func (s *ImageService) UploadImages(files []*multipart.FileHeader) ([]*UploadedImage, error) {
	var uploadedImages []*UploadedImage

	for _, file := range files {
		uploadedImage, err := s.processImage(file)
		if err != nil {
			return nil, err
		}
		uploadedImages = append(uploadedImages, uploadedImage)
	}

	return uploadedImages, nil
}

func (s *ImageService) processImage(file *multipart.FileHeader) (*UploadedImage, error) {
	if shouldUseImageMagickForUpload(file) {
		return s.processImageWithImageMagick(file)
	}

	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	img, format, err := image.Decode(src)
	if err != nil {
		return nil, err
	}

	width := img.Bounds().Dx()
	height := img.Bounds().Dy()

	uuid := generateUUID()
	ext := filepath.Ext(file.Filename)
	originalPath, originalLogicalPath := s.getStoragePath("originals", uuid, ext)
	thumbnailPath, thumbnailLogicalPath := s.getStoragePath("thumbnails", uuid, ".jpg")
	transcodedPath := ""
	transcodedLogicalPath := ""
	if shouldTranscodeOriginal(format, ext, file.Header.Get("Content-Type")) {
		transcodedPath, transcodedLogicalPath = s.getStoragePath("transcoded", uuid+"-transcoded", ".jpg")
	}

	originalDir := filepath.Dir(originalPath)
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return nil, err
	}

	thumbnailDir := filepath.Dir(thumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		return nil, err
	}
	if transcodedPath != "" {
		transcodedDir := filepath.Dir(transcodedPath)
		if err := os.MkdirAll(transcodedDir, 0755); err != nil {
			return nil, err
		}
	}

	src.Seek(0, 0)
	dst, err := os.Create(originalPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return nil, err
	}

	thumbnailImg := imaging.Resize(img, thumbnailMaxWidth, 0, imaging.Lanczos)
	if err := imaging.Save(thumbnailImg, thumbnailPath, imaging.JPEGQuality(thumbnailQuality)); err != nil {
		return nil, err
	}
	if transcodedPath != "" {
		if err := imaging.Save(img, transcodedPath, imaging.JPEGQuality(90)); err != nil {
			return nil, err
		}
	}

	return &UploadedImage{
		StoragePath:      originalLogicalPath,
		ThumbnailPath:    thumbnailLogicalPath,
		TranscodedPath:   transcodedLogicalPath,
		FileSize:         file.Size,
		Width:            width,
		Height:           height,
		OriginalFilename: file.Filename,
	}, nil
}

func (s *ImageService) processImageWithImageMagick(file *multipart.FileHeader) (*UploadedImage, error) {
	cfg, err := s.getImageMagickSettings()
	if err != nil {
		return nil, err
	}
	if !cfg.Enabled {
		return nil, errors.New("ImageMagick integration is disabled. Please enable it in System Settings")
	}

	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	uuid := generateUUID()
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".psd"
	}
	originalPath, originalLogicalPath := s.getStoragePath("originals", uuid, ext)
	thumbnailPath, thumbnailLogicalPath := s.getStoragePath("thumbnails", uuid, ".jpg")
	transcodedPath, transcodedLogicalPath := s.getStoragePath("transcoded", uuid+"-transcoded", ".jpg")

	for _, dir := range []string{
		filepath.Dir(originalPath),
		filepath.Dir(thumbnailPath),
		filepath.Dir(transcodedPath),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, err
		}
	}

	dst, err := os.Create(originalPath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return nil, err
	}
	if err := dst.Close(); err != nil {
		return nil, err
	}

	input := originalPath + "[0]"
	if err := runImageMagick(cfg.Version, input, "-auto-orient", "-flatten", "-quality", "92", transcodedPath); err != nil {
		return nil, fmt.Errorf("ImageMagick transcoding failed: %w", err)
	}
	if err := runImageMagick(cfg.Version, input, "-auto-orient", "-flatten", "-thumbnail", "400x", "-quality", "85", thumbnailPath); err != nil {
		return nil, fmt.Errorf("ImageMagick thumbnail generation failed: %w", err)
	}

	transcodedImg, err := imaging.Open(transcodedPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open transcoded image: %w", err)
	}
	width := transcodedImg.Bounds().Dx()
	height := transcodedImg.Bounds().Dy()

	return &UploadedImage{
		StoragePath:      originalLogicalPath,
		ThumbnailPath:    thumbnailLogicalPath,
		TranscodedPath:   transcodedLogicalPath,
		FileSize:         file.Size,
		Width:            width,
		Height:           height,
		OriginalFilename: file.Filename,
	}, nil
}

func (s *ImageService) getStoragePath(subDir, uuid, ext string) (string, string) {
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	logicalPath := fmt.Sprintf("%s%s/%s/%s/%s%s", logicalUploadPrefix, subDir, year, month, uuid, ext)
	physicalPath := filepath.Join(uploadBaseDir(), subDir, year, month, uuid+ext)
	return physicalPath, logicalPath
}

func (s *ImageService) DeleteImage(storagePath, thumbnailPath, transcodedPath string) error {
	originalFullPath, err := ResolveUploadPath(storagePath)
	if err != nil {
		return err
	}
	thumbnailFullPath, err := ResolveUploadPath(thumbnailPath)
	if err != nil {
		return err
	}

	if err := os.Remove(originalFullPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	if err := os.Remove(thumbnailFullPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	if strings.TrimSpace(transcodedPath) != "" {
		transcodedFullPath, err := ResolveUploadPath(transcodedPath)
		if err != nil {
			return err
		}
		if err := os.Remove(transcodedFullPath); err != nil && !os.IsNotExist(err) {
			return err
		}
	}

	return nil
}

func shouldTranscodeOriginal(format, ext, contentType string) bool {
	cleanFormat := strings.ToLower(strings.TrimSpace(format))
	if cleanFormat == "bmp" || cleanFormat == "tiff" {
		return true
	}

	cleanExt := strings.ToLower(strings.TrimSpace(ext))
	switch cleanExt {
	case ".bmp", ".dib", ".tif", ".tiff":
		return true
	}

	cleanType := strings.ToLower(strings.TrimSpace(contentType))
	return cleanType == "image/bmp" || cleanType == "image/x-ms-bmp" || cleanType == "image/tiff"
}

type imageMagickSettings struct {
	Enabled bool
	Version string
}

func (s *ImageService) getImageMagickSettings() (*imageMagickSettings, error) {
	settings := &imageMagickSettings{
		Enabled: false,
		Version: ImageMagickVersionV7,
	}
	if s.settingRepo == nil {
		return settings, nil
	}

	if enabled, err := s.settingRepo.Get("imagemagick_enabled"); err == nil {
		settings.Enabled = enabled.Value == "true"
	}
	if version, err := s.settingRepo.Get("imagemagick_version"); err == nil {
		settings.Version = normalizeImageMagickVersion(version.Value)
	}
	return settings, nil
}

func shouldUseImageMagickForUpload(file *multipart.FileHeader) bool {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	contentType := strings.ToLower(strings.TrimSpace(file.Header.Get("Content-Type")))
	switch ext {
	case ".psd", ".ai", ".heic", ".heif", ".avif":
		return true
	}
	switch contentType {
	case "image/psd", "image/x-psd", "image/photoshop", "image/x-photoshop",
		"application/photoshop", "application/x-photoshop", "application/psd",
		"application/postscript", "application/illustrator",
		"image/heic", "image/heif", "image/avif":
		return true
	}
	return false
}

func generateUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *ImageService) ValidateFormat(file *multipart.FileHeader) bool {
	contentType := file.Header.Get("Content-Type")
	_, ok := allowedUploadFormats[contentType]
	return ok
}

func uploadBaseDir() string {
	base := strings.TrimSpace(config.GlobalConfig.Storage.UploadBaseDir)
	if base == "" {
		return "./data/uploads"
	}
	return base
}

func UploadBaseDir() string {
	return uploadBaseDir()
}

func ResolveUploadPath(logicalPath string) (string, error) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(logicalPath, "/"))
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		return "", errors.New("invalid upload path")
	}
	if !strings.HasPrefix(cleaned, logicalUploadPrefix) {
		return "", errors.New("invalid upload path")
	}

	relative := strings.TrimPrefix(cleaned, logicalUploadPrefix)
	baseAbs, err := filepath.Abs(filepath.Clean(uploadBaseDir()))
	if err != nil {
		return "", err
	}

	candidate := filepath.Join(baseAbs, filepath.FromSlash(relative))
	candidateAbs, err := filepath.Abs(candidate)
	if err != nil {
		return "", err
	}
	if candidateAbs != baseAbs && !strings.HasPrefix(candidateAbs, baseAbs+string(os.PathSeparator)) {
		return "", errors.New("invalid upload path")
	}

	return candidateAbs, nil
}
