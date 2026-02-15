package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"illust-nest/internal/repository"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
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

	storage, err := GetStorageProvider()
	if err != nil {
		return nil, err
	}

	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	originalBytes, err := io.ReadAll(src)
	if err != nil {
		return nil, err
	}

	img, format, err := image.Decode(bytes.NewReader(originalBytes))
	if err != nil {
		return nil, err
	}

	width := img.Bounds().Dx()
	height := img.Bounds().Dy()

	uuid := generateUUID()
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	originalLogicalPath := s.getStoragePath("originals", uuid, ext)
	thumbnailLogicalPath := s.getStoragePath("thumbnails", uuid, ".jpg")
	transcodedLogicalPath := ""
	if shouldTranscodeOriginal(format, ext, file.Header.Get("Content-Type")) {
		transcodedLogicalPath = s.getStoragePath("transcoded", uuid+"-transcoded", ".jpg")
	}
	if err := storage.Put(
		context.Background(),
		originalLogicalPath,
		bytes.NewReader(originalBytes),
		int64(len(originalBytes)),
		contentTypeFromFilename(file.Filename),
	); err != nil {
		return nil, err
	}

	thumbnailImg := imaging.Resize(img, thumbnailMaxWidth, 0, imaging.Lanczos)
	var thumbnailBuffer bytes.Buffer
	if err := imaging.Encode(&thumbnailBuffer, thumbnailImg, imaging.JPEG, imaging.JPEGQuality(thumbnailQuality)); err != nil {
		return nil, err
	}
	if err := storage.Put(
		context.Background(),
		thumbnailLogicalPath,
		bytes.NewReader(thumbnailBuffer.Bytes()),
		int64(thumbnailBuffer.Len()),
		"image/jpeg",
	); err != nil {
		return nil, err
	}

	if transcodedLogicalPath != "" {
		var transcodedBuffer bytes.Buffer
		if err := imaging.Encode(&transcodedBuffer, img, imaging.JPEG, imaging.JPEGQuality(90)); err != nil {
			return nil, err
		}
		if err := storage.Put(
			context.Background(),
			transcodedLogicalPath,
			bytes.NewReader(transcodedBuffer.Bytes()),
			int64(transcodedBuffer.Len()),
			"image/jpeg",
		); err != nil {
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

	storage, err := GetStorageProvider()
	if err != nil {
		return nil, err
	}
	originalBytes, err := io.ReadAll(src)
	if err != nil {
		return nil, err
	}

	uuid := generateUUID()
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".psd"
	}
	originalLogicalPath := s.getStoragePath("originals", uuid, ext)
	thumbnailLogicalPath := s.getStoragePath("thumbnails", uuid, ".jpg")
	transcodedLogicalPath := s.getStoragePath("transcoded", uuid+"-transcoded", ".jpg")

	if err := storage.Put(
		context.Background(),
		originalLogicalPath,
		bytes.NewReader(originalBytes),
		int64(len(originalBytes)),
		contentTypeFromFilename(file.Filename),
	); err != nil {
		return nil, err
	}

	tempDir, err := os.MkdirTemp("", "illust-nest-imagemagick-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	tempInputPath := filepath.Join(tempDir, "input"+ext)
	tempThumbPath := filepath.Join(tempDir, "thumbnail.jpg")
	tempTranscodedPath := filepath.Join(tempDir, "transcoded.jpg")

	if err := os.WriteFile(tempInputPath, originalBytes, 0644); err != nil {
		return nil, err
	}

	input := tempInputPath + "[0]"
	if err := runImageMagick(cfg.Version, input, "-auto-orient", "-flatten", "-quality", "92", tempTranscodedPath); err != nil {
		return nil, fmt.Errorf("ImageMagick transcoding failed: %w", err)
	}
	if err := runImageMagick(cfg.Version, input, "-auto-orient", "-flatten", "-thumbnail", "400x", "-quality", "85", tempThumbPath); err != nil {
		return nil, fmt.Errorf("ImageMagick thumbnail generation failed: %w", err)
	}

	transcodedBytes, err := os.ReadFile(tempTranscodedPath)
	if err != nil {
		return nil, err
	}
	thumbnailBytes, err := os.ReadFile(tempThumbPath)
	if err != nil {
		return nil, err
	}
	if err := storage.Put(
		context.Background(),
		transcodedLogicalPath,
		bytes.NewReader(transcodedBytes),
		int64(len(transcodedBytes)),
		"image/jpeg",
	); err != nil {
		return nil, err
	}
	if err := storage.Put(
		context.Background(),
		thumbnailLogicalPath,
		bytes.NewReader(thumbnailBytes),
		int64(len(thumbnailBytes)),
		"image/jpeg",
	); err != nil {
		return nil, err
	}

	transcodedImg, err := imaging.Decode(bytes.NewReader(transcodedBytes))
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

func (s *ImageService) getStoragePath(subDir, uuid, ext string) string {
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	return fmt.Sprintf("%s%s/%s/%s/%s%s", logicalUploadPrefix, subDir, year, month, uuid, ext)
}

func (s *ImageService) DeleteImage(storagePath, thumbnailPath, transcodedPath string) error {
	storage, err := GetStorageProvider()
	if err != nil {
		return err
	}

	if err := storage.Delete(context.Background(), storagePath); err != nil {
		return err
	}
	if err := storage.Delete(context.Background(), thumbnailPath); err != nil {
		return err
	}
	if strings.TrimSpace(transcodedPath) != "" {
		if err := storage.Delete(context.Background(), transcodedPath); err != nil {
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

func contentTypeFromFilename(filename string) string {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(filename)))
	if ext == "" {
		return "application/octet-stream"
	}
	if contentType := mime.TypeByExtension(ext); contentType != "" {
		return contentType
	}
	return "application/octet-stream"
}
